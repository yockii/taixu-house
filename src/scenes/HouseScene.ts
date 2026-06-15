import Phaser from 'phaser';
import { LifeClient, type Domain, type Vitals, type Thought, type Act } from '../sdk';
import { ROOMS, roomForDomain, PRIVATE_ROOM, type RoomDef } from '../rooms';
import { RUNTIME_URL, RUNTIME_TOKEN, VIEW } from '../config';
import { PrivatePanel } from '../privatePanel';
import { ConnectBar } from '../connectBar';

interface RoomView {
  def: RoomDef;
  x: number; y: number; w: number; h: number;
  floorTop: number;   // 地板起始 y（背墙之下）
  cx: number; cy: number;
  rect: Phaser.GameObjects.Rectangle;
}

// HouseScene —— 斜视 2.5D 像素办公室（Star Office 风格的开源对应）。
// 每间区域 = 带高度的背墙(挂装饰) + 俯斜地板 + 3/4 视角家具。生命随 presence.domain 走到对应区。
const PLAN = { x: 24, top: 60, w: 912, bottom: 706, wall: 14, iwall: 10, wallH: 46 };
const C = {
  bg: 0x161118,
  outer: 0x3a2e24, outerTop: 0x55432f,
  wallFace: 0x6f5840, wallTop: 0x917451, wallBase: 0x3a2c1e, // 背墙：正面/受光顶/踢脚
  floor: 0x7a6346, floorDark: 0x664f37,                       // 木地板
  door: 0x4a3826,
};

export default class HouseScene extends Phaser.Scene {
  private client!: LifeClient;
  private rooms: Record<string, RoomView> = {};
  private avatar!: Phaser.GameObjects.Container;
  private avatarTween?: Phaser.Tweens.Tween;
  private bubble!: Phaser.GameObjects.Container;
  private bubbleBg!: Phaser.GameObjects.Rectangle;
  private bubbleTail!: Phaser.GameObjects.Triangle;
  private bubbleTxt!: Phaser.GameObjects.Text;
  private bubbleHideAt = 0;
  private vitalsText!: Phaser.GameObjects.Text;
  private shelfText!: Phaser.GameObjects.Text;
  private intentText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private panel!: PrivatePanel;
  private connectBar!: ConnectBar;

  constructor() { super('house'); }

  preload() {
    this.load.setPath('assets');
    this.load.on('loaderror', () => {});
    this.load.image('avatar', 'character/avatar.png');
    this.load.image('tile-floor', 'tiles/floor.png');
    for (const r of ROOMS) this.load.image('furn-' + r.id, 'furniture/' + r.id + '.png');
    this.load.image('furn-private', 'furniture/private.png');
  }
  private has(key: string) { return this.textures.exists(key); }

  create() {
    this.cameras.main.setBackgroundColor(C.bg);
    this.client = new LifeClient(RUNTIME_URL, RUNTIME_TOKEN);
    this.panel = new PrivatePanel(this.client, () => this.connectStream());
    this.connectBar = new ConnectBar(RUNTIME_URL, (url) => this.switchRuntime(url));

    this.drawTitle();
    this.drawBuilding();
    this.layoutRooms();
    this.drawPrivateRoom();
    this.createAvatar();
    this.createBubble();
    this.bootstrap();
  }

  private geo(col: number, row: number) {
    const innerX = PLAN.x + PLAN.wall;
    const innerTop = PLAN.top + PLAN.wall;
    const innerW = PLAN.w - PLAN.wall * 2;
    const innerH = (PLAN.bottom - PLAN.top) - PLAN.wall * 2;
    const w = (innerW - PLAN.iwall * 2) / 3;
    const h = (innerH - PLAN.iwall) / 2;
    const x = innerX + col * (w + PLAN.iwall);
    const y = innerTop + row * (h + PLAN.iwall);
    return { x, y, w, h };
  }

  private drawTitle() {
    this.add.text(PLAN.x, 8, '太虚 · 生命小屋', { fontFamily: 'monospace', fontSize: '18px', color: '#f0e6d8' });
    this.statusText = this.add.text(VIEW.width - 24, 12, '连接中…', { fontFamily: 'monospace', fontSize: '12px', color: '#888' }).setOrigin(1, 0);
    this.intentText = this.add.text(PLAN.x, VIEW.height - 22, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#c9b89a', wordWrap: { width: VIEW.width - PLAN.x * 2 },
    });
  }

  // 建筑外壳：外墙(带顶面高度) + 投影。
  private drawBuilding() {
    const g = this.add.graphics();
    const ph = PLAN.bottom - PLAN.top;
    g.fillStyle(0x000000, 0.4); g.fillRoundedRect(PLAN.x + 5, PLAN.top + 8, PLAN.w, ph, 8);
    g.fillStyle(C.outer, 1); g.fillRoundedRect(PLAN.x, PLAN.top, PLAN.w, ph, 8);
    g.fillStyle(C.outerTop, 1); g.fillRoundedRect(PLAN.x, PLAN.top, PLAN.w, 10, 6);
  }

  private layoutRooms() {
    for (const def of ROOMS) this.buildRoom(def);
    const lounge = this.rooms['lounge'];
    this.vitalsText = this.add.text(lounge.x + 12, lounge.floorTop + 14, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f0e6d2', lineSpacing: 2,
    });
    const ws = this.rooms['workshop'];
    this.shelfText = this.add.text(ws.x + 12, ws.floorTop + 14, '（加载中…）', {
      fontFamily: 'monospace', fontSize: '10px', color: '#cdebd6', lineSpacing: 2, wordWrap: { width: ws.w - 24 },
    });
  }

  // 一间斜视区域：背墙(高度+受光顶+踢脚+挂饰) + 俯斜地板 + 家具 + 名牌。
  private buildRoom(def: RoomDef): RoomView {
    const { x, y, w, h } = this.geo(def.col, def.row);
    const floorTop = y + PLAN.wallH;
    const g = this.add.graphics();

    // 背墙：正面
    g.fillStyle(C.wallFace, 1); g.fillRect(x, y, w, PLAN.wallH);
    // 背墙受光顶（暗示墙厚度/高度）
    g.fillStyle(C.wallTop, 1); g.fillRect(x, y, w, 8);
    // 墙身房间色晕染
    g.fillStyle(def.color, 0.22); g.fillRect(x, y + 8, w, PLAN.wallH - 8);
    // 踢脚线（墙地交界）
    g.fillStyle(C.wallBase, 1); g.fillRect(x, floorTop - 4, w, 4);

    // 地板
    if (this.has('tile-floor')) {
      this.add.tileSprite(x, floorTop, w, h - PLAN.wallH, 'tile-floor').setOrigin(0, 0);
    } else {
      g.fillStyle(C.floor, 1); g.fillRect(x, floorTop, w, h - PLAN.wallH);
      g.lineStyle(1, C.floorDark, 0.6);
      for (let ly = floorTop + 18; ly < y + h; ly += 18) g.lineBetween(x + 1, ly, x + w - 1, ly);
    }

    this.drawWallDecor(def, x, y, w);
    this.drawFurniture(def, x, floorTop, w, h - PLAN.wallH);

    // 名牌（挂在背墙上）
    this.add.rectangle(x + 8, y + 12, 94, 18, 0x000000, 0.4).setOrigin(0, 0);
    this.add.text(x + 12, y + 13, def.name, { fontFamily: 'monospace', fontSize: '13px', color: rgb(def.accent) });

    const rect = this.add.rectangle(x, y, w, h, 0, 0).setOrigin(0, 0).setStrokeStyle(2, def.accent, 0.0);
    const rv: RoomView = { def, x, y, w, h, floorTop, cx: x + w / 2, cy: floorTop + (h - PLAN.wallH) * 0.62, rect };
    this.rooms[def.id] = rv;
    return rv;
  }

  // 背墙挂饰：按房间类型挂书架/相框/告示牌等（贴在背墙正面）。
  private drawWallDecor(def: RoomDef, x: number, y: number, w: number) {
    const g = this.add.graphics();
    const wy = y + 12;
    switch (def.id) {
      case 'study': { // 书架（彩色书脊）
        const spines = [0xd96459, 0x6aa9d9, 0x8fd694, 0xe0b85a, 0xb589d6, 0xd96459];
        spines.forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(x + w - 130 + i * 19, wy, 15, 22); });
        g.lineStyle(2, 0x3a2a1a, 1); g.strokeRect(x + w - 132, wy - 2, 19 * 6 + 2, 26);
        break;
      }
      case 'social': { // 公告板 + 便签
        g.fillStyle(0x8a6a3a, 1); g.fillRect(x + w - 96, wy, 80, 26);
        [0xffe066, 0x86c5ff, 0xff9aa2].forEach((c, i) => { g.fillStyle(c, 1); g.fillRect(x + w - 90 + i * 26, wy + 5, 20, 16); });
        break;
      }
      case 'arcade': { // 霓虹招牌
        g.fillStyle(0x101018, 1); g.fillRect(x + w - 84, wy, 68, 24);
        g.fillStyle(def.accent, 0.9); g.fillRect(x + w - 80, wy + 4, 60, 16);
        break;
      }
      case 'workshop': { // 工具挂板
        g.fillStyle(0x5a4632, 1); g.fillRect(x + w - 80, wy, 64, 26);
        g.fillStyle(0xb0b0b8, 1); g.fillRect(x + w - 72, wy + 5, 6, 16); g.fillCircle(x + w - 50, wy + 13, 7);
        break;
      }
      case 'lounge': { // 挂画
        g.fillStyle(0x3a2a1a, 1); g.fillRect(x + w - 70, wy, 50, 26);
        g.fillStyle(0x6a90b0, 1); g.fillRect(x + w - 66, wy + 4, 42, 18);
        break;
      }
    }
  }

  // 斜视家具：3/4 视角小方块（正面 + 受光顶 + 投影）。
  private box(x: number, yBottom: number, w: number, height: number, front: number, top: number) {
    const sh = this.add.ellipse(x + w / 2, yBottom + 3, w + 6, 9, 0x000000, 0.22);
    sh.setDepth(1);
    const g = this.add.graphics(); g.setDepth(2);
    g.fillStyle(front, 1); g.fillRect(x, yBottom - height, w, height);          // 正面
    g.fillStyle(top, 1); g.fillRect(x, yBottom - height - 6, w, 8);             // 顶面(亮)
    g.lineStyle(1, 0x000000, 0.25); g.strokeRect(x, yBottom - height, w, height);
  }

  private drawFurniture(def: RoomDef, x: number, floorTop: number, w: number, fh: number) {
    if (this.has('furn-' + def.id)) {
      const img = this.add.image(x + w / 2, floorTop + fh - 8, 'furn-' + def.id).setOrigin(0.5, 1).setDepth(3);
      img.setScale(Math.min((w * 0.66) / img.width, (fh * 0.8) / img.height, 3));
      return;
    }
    const cx = x + w / 2, baseY = floorTop + fh - 14;
    switch (def.id) {
      case 'social': // 圆桌 + 两凳
        this.box(cx - 34, baseY, 68, 16, 0x7a5230, 0xa6743f);
        this.box(cx - 60, baseY + 6, 18, 14, 0x4a3320, 0x6a4a30);
        this.box(cx + 42, baseY + 6, 18, 14, 0x4a3320, 0x6a4a30);
        break;
      case 'study': // 书桌 + 椅 + 台灯
        this.box(cx - 40, baseY, 80, 18, 0x6b4a2a, 0x8a6238);
        this.box(cx - 6, baseY - 18, 14, 14, 0xe0c060, 0xf0d880); // 台灯
        this.box(cx + 30, baseY + 8, 16, 16, 0x4a3320, 0x6a4a30);
        break;
      case 'arcade': // 游戏桌(亮屏)
        this.box(cx - 40, baseY, 80, 22, 0x33233f, 0x4a3358);
        this.box(cx - 30, baseY - 22, 60, 8, def.accent, 0xffffff);
        break;
      case 'workshop': // 工作台 + 料箱
        this.box(cx - 46, baseY, 92, 18, 0x6b4a2a, 0x8a6238);
        this.box(cx + 30, baseY + 8, 22, 18, 0x4a5a3a, 0x6a7a4a);
        break;
      case 'lounge': // 沙发 + 茶几
        this.box(cx - 50, baseY, 84, 22, 0x4a5a6a, 0x647888);
        this.box(cx + 40, baseY + 4, 28, 14, 0x6b4a2a, 0x8a6238);
        break;
    }
  }

  private drawPrivateRoom() {
    const def = PRIVATE_ROOM;
    const { x, y, w, h } = this.geo(def.col, def.row);
    const floorTop = y + PLAN.wallH;
    const g = this.add.graphics();
    g.fillStyle(C.wallFace, 1); g.fillRect(x, y, w, PLAN.wallH);
    g.fillStyle(C.wallTop, 1); g.fillRect(x, y, w, 8);
    g.fillStyle(def.color, 0.28); g.fillRect(x, y + 8, w, PLAN.wallH - 8);
    g.fillStyle(C.wallBase, 1); g.fillRect(x, floorTop - 4, w, 4);
    g.fillStyle(C.floor, 1); g.fillRect(x, floorTop, w, h - PLAN.wallH);

    // 保险箱（斜视）
    const cx = x + w / 2, baseY = floorTop + (h - PLAN.wallH) * 0.6;
    this.box(cx - 42, baseY, 84, 56, 0x6a3a52, 0x8a4a68);
    g.lineStyle(2, 0x44263a, 1); g.strokeRect(cx - 34, baseY - 48, 68, 40);
    g.fillStyle(0xe6c24a, 1); g.fillCircle(cx, baseY - 28, 6);

    this.add.rectangle(x + 8, y + 12, 94, 18, 0x000000, 0.4).setOrigin(0, 0);
    this.add.text(x + 12, y + 13, def.name, { fontFamily: 'monospace', fontSize: '13px', color: rgb(def.accent) });
    this.add.text(cx, baseY - 64, '🔒 点击进入', { fontFamily: 'monospace', fontSize: '12px', color: '#e8b8d0' }).setOrigin(0.5).setDepth(4);

    const hit = this.add.rectangle(x, y, w, h, 0, 0).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.panel.show());
  }

  // 站立小人（斜视）：头 + 身 + 腿 + 投影。
  private createAvatar() {
    const shadow = this.add.ellipse(0, 16, 24, 8, 0x000000, 0.3);
    let parts: Phaser.GameObjects.GameObject[];
    if (this.has('avatar')) {
      const img = this.add.image(0, 16, 'avatar').setOrigin(0.5, 1);
      img.setScale(Math.min(48 / img.height, 3));
      parts = [shadow, img];
    } else {
      const legL = this.add.rectangle(-5, 12, 6, 10, 0x36506a);
      const legR = this.add.rectangle(5, 12, 6, 10, 0x36506a);
      const body = this.add.rectangle(0, 0, 18, 22, 0x4fb6a8).setStrokeStyle(2, 0x12201e, 0.9);
      const head = this.add.circle(0, -16, 10, 0xffd9a8).setStrokeStyle(2, 0x12201e, 0.9);
      const hair = this.add.arc(0, -18, 10, 180, 360, false, 0x6a4a36);
      const eyeL = this.add.rectangle(-3, -16, 2.4, 3, 0x222222);
      const eyeR = this.add.rectangle(3, -16, 2.4, 3, 0x222222);
      parts = [shadow, legL, legR, body, head, hair, eyeL, eyeR];
    }
    const inner = this.add.container(0, 0, parts);
    this.tweens.add({ targets: inner, y: -2, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.avatar = this.add.container(this.rooms['lounge'].cx, this.rooms['lounge'].cy, [inner]);
    this.avatar.setDepth(15);
  }

  private createBubble() {
    this.bubbleBg = this.add.rectangle(0, 0, 160, 40, 0xfdf6e8).setOrigin(0.5, 1).setStrokeStyle(2, 0x3a2a1a, 0.4);
    this.bubbleTail = this.add.triangle(0, 0, 0, 0, 12, 0, 6, 10, 0xfdf6e8).setOrigin(0.5, 0);
    this.bubbleTxt = this.add.text(0, 0, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#3a2a1a', align: 'center', wordWrap: { width: 200 },
    }).setOrigin(0.5, 0.5);
    this.bubble = this.add.container(0, 0, [this.bubbleBg, this.bubbleTail, this.bubbleTxt]).setDepth(25).setVisible(false);
  }

  private async bootstrap() {
    try {
      const snap = await this.client.snapshot();
      this.applyPresence(snap.presence.domain, snap.presence.intent);
      this.applyVitals(snap.vitals);
      if (snap.thoughts?.length) this.showThought(snap.thoughts[snap.thoughts.length - 1]);
    } catch (e) {
      this.statusText.setText('快照失败（runtime 未连？）').setColor('#e08868');
    }
    this.refreshShelf();
    this.connectStream();
  }

  private connectStream() {
    this.client.disconnect();
    this.client.connect({
      open: () => { this.statusText.setText('● 已连接').setColor('#9fe0b8'); this.connectBar.setStatus(true); },
      error: () => { this.statusText.setText('○ 重连中…').setColor('#e08868'); this.connectBar.setStatus(false); },
      presence: (p) => this.applyPresence(p.domain, p.intent),
      vitals: (v) => this.applyVitals(v),
      thought: (t) => { this.showThought(t); this.panel.pushThought(t); },
      act: (a) => this.pulseRoom(a),
    });
  }

  async switchRuntime(url: string, token?: string) {
    this.client.setBaseURL(url);
    this.client.setToken(token ?? '');
    this.statusText.setText('切换中…').setColor('#e0c068');
    await this.bootstrap();
  }

  private async refreshShelf() {
    const skills = await this.client.skills();
    const names = skills.map((s: any) => s?.name ?? s?.skill_name ?? s?.id ?? '?').slice(0, 6);
    this.shelfText.setText('🗄 ' + (names.length ? names.map((n: string) => n).join('\n   ') : '（暂无技能）'));
  }

  private applyPresence(domain: Domain, intent: string) {
    const room = roomForDomain(domain);
    const rv = this.rooms[room.id];
    if (rv) this.moveAvatarTo(rv.cx, rv.cy);
    this.intentText.setText(intent ? `🎯 ${intent}` : '');
    for (const id in this.rooms) {
      const r = this.rooms[id];
      r.rect.setStrokeStyle(3, r.def.accent, id === room.id ? 0.95 : 0.0);
    }
  }

  private moveAvatarTo(x: number, y: number) {
    this.avatarTween?.stop();
    this.avatarTween = this.tweens.add({ targets: this.avatar, x, y, duration: 900, ease: 'Sine.inOut' });
  }

  private applyVitals(v: Vitals) {
    const bar = (val: number) => {
      const n = Math.max(0, Math.min(1, val));
      const f = Math.round(n * 8);
      return '█'.repeat(f) + '░'.repeat(8 - f);
    };
    this.vitalsText.setText([
      `体力 ${bar(v.energy)}`, `社交 ${bar(v.social_need)}`, `压力 ${bar(v.stress)}`,
      `自信 ${bar(v.confidence)}`, `动机 ${bar(v.motivation)}`, `满足 ${bar(v.satisfaction)}`,
      `焦虑 ${bar(v.anxiety)}`, `灵韵 ${v.wealth?.toFixed?.(0) ?? '0'}`,
    ].join('\n'));
  }

  private showThought(t: Thought) {
    const icon = { speech: '💬', reflection: '✨', intent: '🎯', memory: '📎' }[t.kind] ?? '💬';
    this.bubbleTxt.setText(`${icon} ${clip(t.text, 90)}`);
    const tw = Math.min(Math.max(this.bubbleTxt.width + 22, 90), 224);
    const th = this.bubbleTxt.height + 16;
    this.bubbleBg.setSize(tw, th);
    this.bubbleTxt.setPosition(0, -th / 2);
    this.bubble.setVisible(true);
    this.bubbleHideAt = this.time.now + 5400;
  }

  private pulseRoom(a: Act) {
    const room = roomForDomain(a.domain);
    const rv = this.rooms[room.id];
    if (!rv) return;
    const flash = this.add.rectangle(rv.x, rv.floorTop, rv.w, rv.h - PLAN.wallH, a.ok ? 0xffffff : 0xff5050, 0.14).setOrigin(0, 0).setDepth(6);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Quad.out', onComplete: () => flash.destroy() });
  }

  update() {
    if (this.bubble.visible) {
      const bx = Phaser.Math.Clamp(this.avatar.x, PLAN.x + 120, PLAN.x + PLAN.w - 120);
      const by = Math.max(this.avatar.y - 30, PLAN.top + 56);
      this.bubble.setPosition(bx, by);
      if (this.time.now > this.bubbleHideAt) this.bubble.setVisible(false);
    }
  }
}

function clip(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
function rgb(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}
