// ============================================================================
// EditorScene —— 路点图编辑器
// ============================================================================
//
// 在背景图上画「路点图」：放置节点、连线、给节点标房间。
// 产物存 localStorage（主页面运行时读取），可导出/导入 JSON。
//
// 三种交互模式（左侧 DOM 工具栏切换）：
//   1. 节点：点击空白添加节点；拖动节点移动；点节点选中后可标房间/删除
//   2. 连线：依次点两个节点，连一条边
//   3. 房间：选中节点后，点工具栏的房间按钮给该节点标 roomId
//
// 节点 = 圆点（房间节点带颜色和标签，中转点灰色）；连线 = 线段。
// ============================================================================

import Phaser from 'phaser';
import { CANVAS, ALL_ROOMS } from '../rooms';
import { loadLayout, saveLayout, exportLayoutJSON, defaultLayout, type Layout, type GraphNode, type GraphEdge } from '../layout';
import { loadBackground, saveBackground, clearBackground, hasBackground } from '../bgStore';

const ROOM_COLORS: Record<string, number> = Object.fromEntries(
  ALL_ROOMS.map((r) => [r.id, r.accent]),
);

type Mode = 'select' | 'add' | 'edge' | 'del' | 'room';

interface NodeView {
  node: GraphNode;
  circle: Phaser.GameObjects.Arc;
  label?: Phaser.GameObjects.Text;
}

export default class EditorScene extends Phaser.Scene {
  private layout!: Layout;
  private nodeViews: Record<string, NodeView> = {};
  private edgeG!: Phaser.GameObjects.Graphics;
  private mode: Mode = 'select';
  private selectedId: string | null = null;
  private edgeFrom: string | null = null; // 连线模式下第一个点
  private toolbar!: HTMLElement;
  private status!: HTMLElement;

  constructor() { super('editor'); }

  preload() {
    this.load.on('loaderror', () => {});
    // 异步：先试 IndexedDB 里的背景图，没有则回退 assets/office_bg.png
    this.loadBackgroundIntoScene();
  }

  private async loadBackgroundIntoScene() {
    const blob = await loadBackground();
    if (blob) {
      // IndexedDB 有图：用 blob URL 加载
      const url = URL.createObjectURL(blob);
      this.load.image('office_bg', url);
      this.load.start();
    } else {
      this.load.setPath('assets');
      this.load.image('office_bg', 'office_bg.png');
      this.load.start();
    }
  }

  create() {
    this.cameras.main.setBackgroundColor(0x14141a);
    this.layout = loadLayout();

    // 背景图
    this.add.rectangle(CANVAS.w / 2, CANVAS.h / 2, CANVAS.w, CANVAS.h, 0x14141a).setDepth(-2);
    if (this.textures.exists('office_bg')) {
      this.add.image(CANVAS.w / 2, CANVAS.h / 2, 'office_bg').setDisplaySize(CANVAS.w, CANVAS.h).setDepth(-1);
    }

    // 房间高亮矩形（只读参考）
    const roomG = this.add.graphics().setDepth(0);
    for (const r of this.layout.rooms) {
      roomG.lineStyle(2, parseInt(r.accent, 16), 0.5);
      roomG.strokeRect(r.rect.x, r.rect.y, r.rect.w, r.rect.h);
    }

    this.edgeG = this.add.graphics().setDepth(1);

    // 渲染现有节点和边
    this.rebuildNodes();
    this.drawEdges();

    // 交互：点击画布
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onCanvasClick(p));

    this.buildToolbar();
  }

  // --------------------------------------------------------------------------
  // 节点渲染
  // --------------------------------------------------------------------------

  private rebuildNodes() {
    // 清旧
    for (const id in this.nodeViews) {
      this.nodeViews[id].circle.destroy();
      this.nodeViews[id].label?.destroy();
    }
    this.nodeViews = {};
    for (const n of this.layout.nodes) this.addNodeView(n);
  }

  private addNodeView(n: GraphNode) {
    const isRoom = !!n.roomId;
    const color = n.roomId ? ROOM_COLORS[n.roomId] : 0x888888;
    const radius = isRoom ? 10 : 7;
    const circle = this.add.circle(n.x, n.y, radius, color, 0.9).setDepth(5).setStrokeStyle(2, 0xffffff, 0.8);
    // 房间节点加标签
    let label: Phaser.GameObjects.Text | undefined;
    if (isRoom && n.roomId) {
      const name = ALL_ROOMS.find((r) => r.id === n.roomId)?.name ?? n.roomId;
      label = this.add.text(n.x, n.y - 16, name, {
        fontFamily: 'monospace', fontSize: '12px', color: '#' + color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5, 1).setDepth(6);
    }
    // 拖动
    circle.setInteractive({ draggable: true });
    this.input.setDraggable(circle);
    circle.on('drag', (_pointer: Phaser.Input.Pointer, x: number, y: number) => {
      n.x = x; n.y = y; circle.setPosition(x, y); label?.setPosition(x, y - 16);
      this.drawEdges();
    });
    circle.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // 点击节点（不拖动）：选中 / 连线起点
      pointer.event.stopPropagation();
      this.onNodeClick(n.id);
    });
    this.nodeViews[n.id] = { node: n, circle, label };
  }

  private drawEdges() {
    this.edgeG.clear();
    this.edgeG.lineStyle(2, 0xffe6a0, 0.6);
    const byId = new Map(this.layout.nodes.map((n) => [n.id, n]));
    for (const e of this.layout.edges) {
      const a = byId.get(e.a), b = byId.get(e.b);
      if (!a || !b) continue;
      this.edgeG.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  // --------------------------------------------------------------------------
  // 交互
  // --------------------------------------------------------------------------

  private onCanvasClick(p: Phaser.Input.Pointer) {
    const x = p.worldX, y = p.worldY;
    if (this.mode === 'select') {
      // 点空白取消选中
      this.selectNode(null);
      return;
    }
    if (this.mode === 'add') {
      // 只能在线段上添加：找点击位置最近的边，在其上插入节点（拆边）
      const hit = this.nearestEdgePoint(x, y, 24); // 24px 容差
      if (!hit) { this.setStatus('请点在一条连线上添加节点'); return; }
      this.insertNodeOnEdge(hit.edge, { x: hit.x, y: hit.y });
      // 加完自动切回选择模式，便于拖动新节点
      this.mode = 'select';
      this.refreshModeButtons();
      this.setStatus(`+ 中转节点（已拆分连线），已切回选择模式，可拖动调整`);
      return;
    }
    if (this.mode === 'del') {
      // 删线：点中哪条边就删哪条
      const hit = this.nearestEdgePoint(x, y, 24);
      if (!hit) { this.setStatus('请点在一条连线上删除'); return; }
      this.layout.edges = this.layout.edges.filter((e) => !(e.a === hit.edge.a && e.b === hit.edge.b));
      this.drawEdges();
      this.setStatus(`🗑 已删除连线 ${hit.edge.a} — ${hit.edge.b}`);
      return;
    }
  }

  /** 找点击位置最近的边及其上的最近点。容差内返回，否则 null。 */
  private nearestEdgePoint(x: number, y: number, tolerance: number): { edge: GraphEdge; x: number; y: number } | null {
    const byId = new Map(this.layout.nodes.map((n) => [n.id, n]));
    let best: { edge: GraphEdge; x: number; y: number; d: number } | null = null;
    for (const e of this.layout.edges) {
      const a = byId.get(e.a), b = byId.get(e.b);
      if (!a || !b) continue;
      const proj = projectOnSegment(x, y, a.x, a.y, b.x, b.y);
      if (proj.d <= tolerance && (!best || proj.d < best.d)) {
        best = { edge: e, x: proj.x, y: proj.y, d: proj.d };
      }
    }
    return best ? { edge: best.edge, x: best.x, y: best.y } : null;
  }

  /** 在某条边上插入一个新节点（拆边：删原边，加两条新边经过新节点）。 */
  private insertNodeOnEdge(edge: GraphEdge, pos: { x: number; y: number }) {
    const id = 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const n: GraphNode = { id, x: pos.x, y: pos.y };
    this.layout.nodes.push(n);
    this.addNodeView(n);
    // 拆边
    this.layout.edges = this.layout.edges.filter((e) => !(e.a === edge.a && e.b === edge.b));
    this.layout.edges.push({ a: edge.a, b: id }, { a: id, b: edge.b });
    this.drawEdges();
    this.selectNode(id);
  }

  private onNodeClick(id: string) {
    this.selectNode(id);
    if (this.mode === 'edge') {
      if (!this.edgeFrom) {
        this.edgeFrom = id;
        this.setStatus(`连线：点第二个节点（从 ${id}）`);
      } else if (this.edgeFrom !== id) {
        // 添加边（去重）
        const exists = this.layout.edges.some((e) =>
          (e.a === this.edgeFrom && e.b === id) || (e.a === id && e.b === this.edgeFrom));
        if (!exists) {
          this.layout.edges.push({ a: this.edgeFrom!, b: id });
          this.drawEdges();
          this.setStatus(`+ 连线 ${this.edgeFrom} — ${id}`);
        }
        this.edgeFrom = null;
      }
    }
  }

  private selectNode(id: string | null) {
    // 取消旧选中描边
    if (this.selectedId && this.nodeViews[this.selectedId]) {
      this.nodeViews[this.selectedId].circle.setStrokeStyle(2, 0xffffff, 0.8);
    }
    this.selectedId = id;
    if (id && this.nodeViews[id]) {
      this.nodeViews[id].circle.setStrokeStyle(3, 0xffe066, 1);
      this.setStatus(`选中 ${id}${this.nodeViews[id].node.roomId ? '（' + this.nodeViews[id].node.roomId + '）' : '（中转点）'}`);
    }
    this.refreshRoomButtons();
  }

  // --------------------------------------------------------------------------
  // DOM 工具栏
  // --------------------------------------------------------------------------

  private buildToolbar() {
    const tb = document.createElement('div');
    tb.style.cssText = [
      'position:fixed', 'top:10px', 'left:10px', 'z-index:900',
      'display:flex', 'flex-direction:column', 'gap:6px',
      'padding:10px', 'background:rgba(20,16,24,0.92)',
      'border:1px solid #444', 'border-radius:8px',
      'font-size:12px', 'min-width:150px',
    ].join(';');

    const title = document.createElement('div');
    title.textContent = '🛠 布局编辑器';
    title.style.cssText = 'color:#9fb6ec;font-size:13px;margin-bottom:4px;';
    tb.appendChild(title);

    // 模式
    tb.appendChild(this.groupLabel('模式'));
    const modes: [Mode, string][] = [
      ['select', '① 选择(点选/拖动节点)'],
      ['add', '② 添加节点(只能点连线上)'],
      ['edge', '③ 连线(点两节点)'],
      ['del', '④ 删连线(点一条线)'],
      ['room', '⑤ 标房间(选节点后点)'],
    ];
    for (const [m, label] of modes) {
      const b = this.mkBtn(label, () => { this.mode = m; this.edgeFrom = null; this.refreshModeButtons(); this.setStatus('模式：' + label); });
      b.dataset.mode = m;
      tb.appendChild(b);
    }
    this.toolbar = tb;

    // 房间标签（room 模式下点）
    tb.appendChild(this.groupLabel('标房间（先选中节点）'));
    for (const r of ALL_ROOMS) {
      const b = this.mkBtn(r.name, () => this.tagRoom(r.id));
      b.dataset.room = r.id;
      b.style.color = '#' + r.accent.toString(16).padStart(6, '0');
      tb.appendChild(b);
    }
    const clearTag = this.mkBtn('取消房间标签', () => this.tagRoom(undefined));
    clearTag.dataset.room = '';
    tb.appendChild(clearTag);

    // 背景图
    tb.appendChild(this.groupLabel('背景图（存浏览器本地）'));
    tb.appendChild(this.mkBtn('🖼 导入背景图...', this.importBackground.bind(this)));
    const clearBg = this.mkBtn('✕ 清除背景图（恢复默认）', async () => {
      await clearBackground(); this.setStatus('已清除，刷新生效');
    });
    clearBg.dataset.bgclear = '1';
    tb.appendChild(clearBg);

    // 操作
    tb.appendChild(this.groupLabel('操作'));
    tb.appendChild(this.mkBtn('🗑 删除选中节点', this.deleteSelected.bind(this)));
    tb.appendChild(this.mkBtn('↺ 重置为默认', () => { this.layout = defaultLayout(); this.rebuildNodes(); this.drawEdges(); this.setStatus('已重置为默认布局'); }));
    tb.appendChild(this.mkBtn('💾 保存到浏览器', () => { saveLayout(this.layout); this.setStatus('✓ 已保存（刷新主页面生效）'); }));
    tb.appendChild(this.mkBtn('📥 导出 layout.json', () => exportLayoutJSON(this.layout)));
    tb.appendChild(this.mkBtn('📤 导入 layout.json', this.importJSON.bind(this)));
    tb.appendChild(this.mkBtn('🏠 回到主页', () => { location.href = location.pathname.replace(/editor\.html$/, ''); }));

    // 状态栏
    this.status = document.createElement('div');
    this.status.style.cssText = 'color:#cdebd6;margin-top:4px;min-height:16px;';
    tb.appendChild(this.groupLabel('状态'));
    tb.appendChild(this.status);

    document.body.appendChild(tb);
    this.refreshModeButtons();
    this.refreshRoomButtons();
    this.refreshBgStatus();
    this.setStatus('就绪。模式①选择/拖动节点，②点连线添加节点');
  }

  private groupLabel(text: string): HTMLElement {
    const e = document.createElement('div');
    e.textContent = text;
    e.style.cssText = 'color:#888;font-size:11px;margin-top:6px;border-bottom:1px solid #333;padding-bottom:2px;';
    return e;
  }

  private mkBtn(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'text-align:left;padding:5px 8px;background:#2a2a36;border:1px solid #444;border-radius:4px;color:#e0e2ee;cursor:pointer;font-family:monospace;font-size:11px;';
    b.addEventListener('click', onClick);
    return b;
  }

  private refreshModeButtons() {
    this.toolbar.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => {
      const on = b.dataset.mode === this.mode;
      b.style.background = on ? '#3a5fb0' : '#2a2a36';
      b.style.color = on ? '#fff' : '#e0e2ee';
    });
  }

  private refreshRoomButtons() {
    // room 模式且选中了节点时高亮房间按钮
    const active = this.mode === 'room' && this.selectedId;
    this.toolbar.querySelectorAll<HTMLElement>('[data-room]').forEach((b) => {
      const on = active && this.selectedId && this.nodeViews[this.selectedId]?.node.roomId === b.dataset.room;
      b.style.background = on ? '#3a5fb0' : '#2a2a36';
    });
  }

  private tagRoom(roomId: string | undefined) {
    if (!this.selectedId) { this.setStatus('请先选中一个节点'); return; }
    const nv = this.nodeViews[this.selectedId];
    if (!nv) return;
    nv.node.roomId = roomId;
    // 重建该节点视图（更新颜色/标签）
    nv.circle.destroy(); nv.label?.destroy();
    delete this.nodeViews[this.selectedId];
    this.addNodeView(nv.node);
    this.selectNode(this.selectedId);
    this.setStatus(roomId ? `✓ ${nv.node.id} 标为 ${roomId}` : `✓ ${nv.node.id} 取消房间标签`);
  }

  private deleteSelected() {
    if (!this.selectedId) { this.setStatus('请先选中节点'); return; }
    const id = this.selectedId;
    // 删节点 + 相关边
    this.layout.nodes = this.layout.nodes.filter((n) => n.id !== id);
    this.layout.edges = this.layout.edges.filter((e) => e.a !== id && e.b !== id);
    this.nodeViews[id]?.circle.destroy();
    this.nodeViews[id]?.label?.destroy();
    delete this.nodeViews[id];
    this.selectedId = null;
    this.drawEdges();
    this.setStatus('🗑 已删除 ' + id);
  }

  private importJSON() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files?.[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string);
          // 复用 layout 的规范化：存再读
          saveLayout(parsed);
          this.layout = loadLayout();
          this.rebuildNodes(); this.drawEdges();
          this.setStatus('✓ 已导入 layout.json');
        } catch { this.setStatus('❌ JSON 解析失败'); }
      };
      reader.readAsText(f);
    };
    input.click();
  }

  private setStatus(text: string) { if (this.status) this.status.textContent = text; }

  /** 导入本地背景图：选文件 → 存 IndexedDB → 提示刷新生效。 */
  private importBackground() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/webp';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      await saveBackground(f);
      this.setStatus(`✓ 已导入背景图（${f.name}），刷新页面生效`);
      this.refreshBgStatus();
    };
    input.click();
  }

  /** 刷新「清除背景图」按钮的可用状态。 */
  private async refreshBgStatus() {
    const has = await hasBackground();
    const btn = this.toolbar.querySelector<HTMLElement>('[data-bgclear]');
    if (btn) {
      btn.style.opacity = has ? '1' : '0.4';
      btn.textContent = has ? '✕ 清除背景图（恢复默认）' : '✕ 无自定义背景图';
    }
  }
}

/** 点 (px,py) 到线段 (ax,ay)-(bx,by) 的最近点及距离。 */
function projectOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): { x: number; y: number; d: number } {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: ax, y: ay, d: Math.hypot(px - ax, py - ay) };
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx, y = ay + t * dy;
  return { x, y, d: Math.hypot(px - x, py - y) };
}
