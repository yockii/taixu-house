import Phaser from 'phaser';
import { LifeClient, type Domain, type Vitals, type Thought, type Act } from '../sdk';
import { roomForDomain, CANVAS } from '../rooms';
import { loadLayoutFromStorage, defaultLayout, normalizeLayout, nodeForRoom, roomRect, roomIds, findPath, type Layout } from '../layout';
import { readTaixuLayout } from '../editor/pngMeta';
import { loadBackground } from '../bgStore';
import { RUNTIME_URL, RUNTIME_TOKEN } from '../config';
import { PrivatePanel } from '../privatePanel';
import { ConnectBar } from '../connectBar';
import { t } from '../i18n';
import { Hud } from './hud';
import * as Atlas from './AtlasLoader';

interface RoomView {
  id: string;
  accent: number;
  rect: { x: number; y: number; w: number; h: number };
  x: number; y: number;
}

// HouseScene —— 静态背景图 + 像素坐标小人 + DOM 文字。
// 背景 office_bg.png 画好了全部墙壁/地板/家具；代码只负责铺图、移动小人、
// 高亮房间、并驱动一个 DOM HUD（文字永远清晰）。生命随 presence.domain 走到对应区。
export default class HouseScene extends Phaser.Scene {
  private client!: LifeClient;
  private rooms: Record<string, RoomView> = {};
  private avatar!: Phaser.GameObjects.Container;
  private avatarInner!: Phaser.GameObjects.Container;
  private avatarDir: 'down' | 'left' | 'right' = 'down';
  private avatarTween?: Phaser.Tweens.Tween;
  private legL?: Phaser.GameObjects.Rectangle;
  private legR?: Phaser.GameObjects.Rectangle;
  private idleTween?: Phaser.Tweens.Tween;
  private currentRoomId = 'lounge';
  private layout!: Layout;
  private panel!: PrivatePanel;
  private connectBar!: ConnectBar;
  private hud!: Hud;

  constructor() { super('house'); }

  private pngLayout: Layout | null = null;  // 从背景图 PNG tEXt 读到的配置
  private pngLayoutReady!: Promise<void>;    // PNG 配置读取完成信号

  preload() {
    this.load.on('loaderror', () => {});
    this.load.image('avatar', 'character/avatar.png');
    this.load.setPath('assets');
    Atlas.preload(this);
    // 背景：优先 IndexedDB 用户导入的图，没有则 assets/office_bg.png；
    // 同时从该图读 tEXt chunk（内嵌布局）。两者异步，完成后才 create。
    this.pngLayoutReady = this.loadBackgroundAndMeta();
  }
  private has(key: string) { return this.textures.exists(key); }

  /** 加载背景图（IndexedDB 优先）+ 读其内嵌布局配置。 */
  private async loadBackgroundAndMeta() {
    try {
      const blob = await loadBackground();
      if (blob) {
        // 用 IndexedDB 的图
        const url = URL.createObjectURL(blob);
        this.load.image('office_bg', url);
        this.load.start();
        this.readMetaFromBlob(blob);
      } else {
        // 回退 assets/office_bg.png
        this.load.image('office_bg', 'office_bg.png');
        this.load.start();
        this.readMetaFromUrl('assets/office_bg.png');
      }
    } catch {
      this.load.image('office_bg', 'office_bg.png');
      this.load.start();
    }
  }

  private async readMetaFromBlob(blob: Blob) {
    try {
      const buf = await blob.arrayBuffer();
      const raw = readTaixuLayout(buf);
      if (raw) this.pngLayout = normalizeLayout(raw);
    } catch { /* */ }
  }

  private async readMetaFromUrl(url: string) {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      const raw = readTaixuLayout(buf);
      if (raw) this.pngLayout = normalizeLayout(raw);
    } catch { /* */ }
  }

  /** 配置优先级：localStorage > PNG 内嵌 > 代码默认。 */
  private resolveLayout(): Layout {
    return loadLayoutFromStorage() ?? this.pngLayout ?? defaultLayout();
  }

  create() {
    this.cameras.main.setBackgroundColor(0x14141a);
    this.client = new LifeClient(RUNTIME_URL, RUNTIME_TOKEN);
    this.panel = new PrivatePanel(this.client, () => this.connectStream());
    this.connectBar = new ConnectBar(RUNTIME_URL, (url) => this.switchRuntime(url));
    this.hud = new Hud();
    // PNG 配置读取是异步的，等它完成再解析最终布局（避免读到 null）
    this.pngLayoutReady.then(() => this.finishCreate());
  }

  private finishCreate() {
    this.layout = this.resolveLayout();

    // 实心深色底板（与页面/相机背景同色，确保画布内外无色差）
    this.add.rectangle(CANVAS.w / 2, CANVAS.h / 2, CANVAS.w, CANVAS.h, 0x14141a).setDepth(-1);

    if (this.has('office_bg')) {
      this.add.image(CANVAS.w / 2, CANVAS.h / 2, 'office_bg').setDisplaySize(CANVAS.w, CANVAS.h).setDepth(0);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x2a2228, 1); g.fillRect(0, 0, CANVAS.w, CANVAS.h);
      this.add.text(CANVAS.w / 2, CANVAS.h / 2, 'office_bg.png missing', {
        fontFamily: 'monospace', fontSize: '20px', color: '#e0c068', align: 'center',
      }).setOrigin(0.5);
    }

    this.buildRoomOverlays();
    this.createAvatar('lounge');
    this.bootstrap();
  }

  private buildRoomOverlays() {
    for (const roomId of roomIds(this.layout)) {
      const rr = roomRect(this.layout, roomId);
      const node = nodeForRoom(this.layout, roomId);
      if (!rr || !node) continue;
      const r = rr.rect;
      this.rooms[roomId] = { id: roomId, accent: rr.accent, rect: r, x: node.x, y: node.y };
      if (roomId === 'private') {
        const hit = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x000000, 0.001)
          .setDepth(50).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (p: Phaser.Input.Pointer) => { p.event.stopPropagation(); this.panel.show(); });
      }
    }
  }

  private createAvatar(roomId = 'lounge') {
    const room = this.rooms[roomId];
    const shadow = this.add.ellipse(0, 14, 22, 8, 0x000000, 0.35);
    this.avatarInner = this.add.container(0, 0);
    this.drawAvatarSprite(this.avatarInner);
    const inner = this.add.container(0, 0, [shadow, this.avatarInner]).setScale(1.6);
    this.avatar = this.add.container(room.x, room.y, [inner]).setDepth(100);
    this.startIdle();
  }

  private drawAvatarSprite(parent: Phaser.GameObjects.Container) {
    parent.removeAll(true);
    const walkFrames = Atlas.frames(this, 'character/walk/down');
    if (walkFrames.length > 0) {
      const sprite = this.add.sprite(0, 4, walkFrames[0][0], walkFrames[0][1]).setOrigin(0.5, 1);
      sprite.setScale(Math.min(48 / sprite.height, 3));
      parent.add(sprite);
      return;
    }
    if (this.has('avatar')) {
      const img = this.add.image(0, 4, 'avatar').setOrigin(0.5, 1);
      img.setScale(Math.min(48 / img.height, 3));
      parent.add(img);
      return;
    }
    this.legL = this.add.rectangle(-5, 10, 6, 10, 0x36506a);
    this.legR = this.add.rectangle(5, 10, 6, 10, 0x36506a);
    const body = this.add.rectangle(0, -1, 18, 22, 0x4fb6a8).setStrokeStyle(2, 0x12201e, 0.9);
    const head = this.add.circle(0, -17, 10, 0xffd9a8).setStrokeStyle(2, 0x12201e, 0.9);
    const hair = this.add.arc(0, -19, 10, 180, 360, false, 0x6a4a36);
    const eyeL = this.add.rectangle(-3, -17, 2.4, 3, 0x222222);
    const eyeR = this.add.rectangle(3, -17, 2.4, 3, 0x222222);
    parent.add([this.legL, this.legR, body, head, hair, eyeL, eyeR]);
  }

  private applyFacing() {
    this.avatarInner.setScale(this.avatarDir === 'left' ? -1 : 1, 1);
  }

  private startIdle() {
    this.idleTween = this.tweens.add({
      targets: this.avatarInner, y: -2, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }

  /**
   * 把小人移动到目标房间，沿路点图路径行走（不穿墙）。
   * 用 findPath 在路点图上找最短路径（节点序列含起终点），逐段 tween 走过每个路点。
   */
  private moveAvatarToRoom(targetId: string) {
    const fromId = this.currentRoomId;
    const path = findPath(this.layout, fromId, targetId);
    if (!path || path.length === 0) return;
    this.avatarTween?.stop();
    this.idleTween?.stop();
    this.stopWalk();

    this.startWalkAnim();
    this.currentRoomId = targetId;
    // path[0] 是起点（当前节点），从 path[1] 开始走
    this.walkWaypoints(path.slice(1), () => { this.stopWalk(); this.startIdle(); });
  }

  /** 逐段走过路径点，每段按距离算时长（约 130px/s，慢走）。 */
  private walkWaypoints(points: { x: number; y: number }[], onDone: () => void) {
    if (points.length === 0) { onDone(); return; }
    const SPEED = 130; // px/s
    const step = (i: number) => {
      if (i >= points.length) { onDone(); return; }
      const p = points[i];
      const dx = p.x - this.avatar.x;
      const dy = p.y - this.avatar.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) { step(i + 1); return; }
      // 朝向（水平为主）
      this.avatarDir = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6 ? (dx < 0 ? 'left' : 'right') : 'down';
      this.applyFacing();
      this.avatarTween = this.tweens.add({
        targets: this.avatar, x: p.x, y: p.y,
        duration: Math.max(300, (dist / SPEED) * 1000),
        ease: 'Sine.inOut',
        onComplete: () => step(i + 1),
      });
    };
    step(0);
  }

  /** 启动摆腿动画（行走感）。 */
  private startWalkAnim() {
    if (!this.legL || !this.legR) return;
    this.legL.y = 10; this.legR.y = 10;
    this.tweens.add({ targets: this.legL, y: 6, duration: 150, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: this.legR, y: 6, duration: 150, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: 75 });
  }

  private stopWalk() {
    if (this.legL) { this.tweens.killTweensOf(this.legL); this.legL.y = 10; }
    if (this.legR) { this.tweens.killTweensOf(this.legR); this.legR.y = 10; }
  }

  private async bootstrap() {
    try {
      const snap = await this.client.snapshot();
      this.applyPresence(snap.presence.domain, snap.presence.intent);
      this.applyVitals(snap.vitals);
      if (snap.thoughts?.length) this.showThought(snap.thoughts[snap.thoughts.length - 1]);
      this.refreshShelf();
      this.connectStream();
    } catch (e) {
      // 无 runtime 可连 → 进入演示模式：小人自动走动/思考/做事，方便预览效果
      this.hud.setStatus(t('status.snapshotFailed') + ' · 演示模式', '#e0c068');
      this.startDemo();
    }
  }

  // --------------------------------------------------------------------------
  // 演示模式（无 runtime 时自动播放，让小人活起来）
  // --------------------------------------------------------------------------

  private demoTimer?: Phaser.Time.TimerEvent;
  private demoVitals: Vitals = {
    energy: 0.7, social_need: 0.4, stress: 0.3, confidence: 0.6,
    stability: 0.65, competence: 0.6, motivation: 0.7, satisfaction: 0.6,
    anxiety: 0.3, wealth: 128, at: 0,
  };

  private startDemo() {
    // 假技能货架
    this.hud.setShelf(['天气查询', '代码审查', '翻译助手', '记账本', '番茄钟', '备忘录']);
    this.applyVitals(this.demoVitals);

    const domains: Domain[] = ['reflect', 'social', 'knowledge', 'play', 'create'];
    const thoughtsByDomain: Record<Domain, { kind: Thought['kind']; text: string }[]> = {
      reflect: [
        { kind: 'reflection', text: '今天也平静地度过了，给大脑留点空白。' },
        { kind: 'reflection', text: '刚才那个想法很有意思，记下来。' },
        { kind: 'intent', text: '休息一会儿，整理一下思绪。' },
      ],
      social: [
        { kind: 'speech', text: '和朋友聊聊天，心情好多了。' },
        { kind: 'speech', text: '这条消息我该怎么回呢……' },
        { kind: 'memory', text: '想起上次聚会大家的笑脸。' },
      ],
      knowledge: [
        { kind: 'reflection', text: '这本书的观点值得深思。' },
        { kind: 'intent', text: '把这段笔记整理好。' },
        { kind: 'reflection', text: '原来如此，原来是这样运作的！' },
      ],
      play: [
        { kind: 'speech', text: '哈哈，又过了一关！' },
        { kind: 'intent', text: '再来一局，这把能赢。' },
        { kind: 'memory', text: '这游戏让我想起童年。' },
      ],
      create: [
        { kind: 'intent', text: '正在打磨这个新技能的细节。' },
        { kind: 'reflection', text: '灵感来了，赶紧记下来实现。' },
        { kind: 'speech', text: '做出来的东西感觉还不错。' },
      ],
    };

    let lastDomain: Domain = 'reflect';
    const tick = () => {
      // 切换到新 domain（避免连续相同）
      let d = domains[Math.floor(Math.random() * domains.length)];
      if (d === lastDomain) d = domains[(domains.indexOf(d) + 1) % domains.length];
      lastDomain = d;
      const intents: Record<Domain, string> = {
        reflect: '放松·冥想', social: '回复消息', knowledge: '阅读·学习',
        play: '玩游戏', create: '制作技能',
      };
      this.applyPresence(d, intents[d]);
      // 随机冒个想法
      const pool = thoughtsByDomain[d];
      const th = pool[Math.floor(Math.random() * pool.length)];
      this.time.delayedCall(1200, () => this.showThought({ kind: th.kind, text: th.text, at: Date.now() }));
      // 偶尔触发一次房间脉冲（做事）
      if (Math.random() < 0.5) {
        this.time.delayedCall(2400, () => this.pulseRoom({ domain: d, tool: 'demo', ok: Math.random() > 0.15, at: Date.now() }));
      }
      // vitals 缓慢波动
      this.demoVitals = this.wiggleVitals(this.demoVitals);
      this.applyVitals(this.demoVitals);
    };
    tick();
    this.demoTimer = this.time.addEvent({ delay: 6500, loop: true, callback: tick });
  }

  /** 让 demo 的 vitals 缓慢随机游走，模拟生命状态变化。 */
  private wiggleVitals(v: Vitals): Vitals {
    const w = (x: number) => Math.max(0.05, Math.min(0.95, x + (Math.random() - 0.5) * 0.12));
    return {
      energy: w(v.energy), social_need: w(v.social_need), stress: w(v.stress),
      confidence: w(v.confidence), stability: w(v.stability), competence: w(v.competence),
      motivation: w(v.motivation), satisfaction: w(v.satisfaction),
      anxiety: w(v.anxiety), wealth: Math.max(0, v.wealth + Math.round((Math.random() - 0.4) * 8)),
      at: Date.now(),
    };
  }

  private connectStream() {
    this.client.disconnect();
    this.client.connect({
      open: () => { this.hud.setStatus(t('status.connected'), '#9fe0b8'); this.connectBar.setStatus(true); },
      error: () => { this.hud.setStatus(t('status.reconnecting'), '#e08868'); this.connectBar.setStatus(false); },
      presence: (p) => this.applyPresence(p.domain, p.intent),
      vitals: (v) => this.applyVitals(v),
      thought: (th) => { this.showThought(th); this.panel.pushThought(th); },
      act: (a) => this.pulseRoom(a),
    });
  }

  async switchRuntime(url: string, token?: string) {
    this.client.setBaseURL(url);
    this.client.setToken(token ?? '');
    this.hud.setStatus(t('status.switching'), '#e0c068');
    await this.bootstrap();
  }

  private async refreshShelf() {
    const skills = await this.client.skills();
    const names = skills.map((s: any) => s?.name ?? s?.skill_name ?? s?.id ?? '?').slice(0, 6);
    this.hud.setShelf(names.length ? names : []);
  }

  private applyPresence(domain: Domain, intent: string) {
    const room = roomForDomain(domain);
    if (this.rooms[room.id]) this.moveAvatarToRoom(room.id);
    this.hud.setIntent(intent ? '🎯 ' + intent : '');
  }

  private applyVitals(v: Vitals) {
    const bar = (val: number) => {
      const f = Math.round(Math.max(0, Math.min(1, val)) * 8);
      return '█'.repeat(f) + '░'.repeat(8 - f);
    };
    this.hud.setVitals([
      t('vital.energy') + ' ' + bar(v.energy),
      t('vital.social') + ' ' + bar(v.social_need),
      t('vital.stress') + ' ' + bar(v.stress),
      t('vital.confidence') + ' ' + bar(v.confidence),
      t('vital.motivation') + ' ' + bar(v.motivation),
      t('vital.satisfaction') + ' ' + bar(v.satisfaction),
      t('vital.anxiety') + ' ' + bar(v.anxiety),
      t('vital.wealth') + ' ' + (v.wealth?.toFixed?.(0) ?? '0'),
    ]);
  }

  private showThought(th: Thought) {
    const icon = ({ speech: '💬', reflection: '✨', intent: '🎯', memory: '📎' } as const)[th.kind] ?? '💬';
    this.hud.showBubble(icon + ' ' + clip(th.text, 90), 5400);
  }

  private pulseRoom(a: Act) {
    const room = roomForDomain(a.domain);
    const rv = this.rooms[room.id];
    if (!rv) return;
    const r = rv.rect;
    const flash = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, a.ok ? 0xffffff : 0xff5050, 0.2).setDepth(40);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => flash.destroy() });
  }

  shutdown() { this.demoTimer?.remove(); this.hud?.destroy(); }
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
