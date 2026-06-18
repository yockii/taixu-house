// ============================================================================
// Layout —— 房间布局配置：路点图、加载、存储、寻路
// ============================================================================
//
// 房间布局用「路点图」(waypoint graph) 表示：
//   - nodes: 路点（节点），每个标注属于哪个房间（roomId，可空=纯中转点）
//   - edges: 节点之间的连线（小人沿边走，编辑器里画成可见的线）
//
// 一个房间 = 一个主节点（roomId 标注）+ 可选的多个中转节点（门口/拐角）。
// 寻路：从当前房间节点到目标房间节点，在图上 BFS 找最短路径，沿节点序列逐段走。
// 不需要「门洞」概念——门洞就是路径经过的中转节点，自然形成。
//
// 配置来源优先级：localStorage > 代码默认（rooms.ts 转换）。永不崩。
// ============================================================================

import { ALL_ROOMS, CANVAS, type RoomDef } from './rooms';

/** 路点（节点）。有 roomId 的节点 = 该房间的站位点。 */
export interface GraphNode {
  id: string;
  x: number; y: number;
  /** 属于哪个房间（study/workshop/lounge/social/arcade/private）。空=纯中转点。 */
  roomId?: string;
}

/** 节点之间的连线（无向）。小人沿边走。 */
export interface GraphEdge {
  a: string; b: string;  // 两个节点 id
}

/** 房间高亮区（用于 presence 高亮矩形，与路点图独立）。 */
export interface RoomRect {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  accent: string;  // 16 进制颜色字符串
}

/** 完整布局配置（layout.json 的结构）。 */
export interface Layout {
  version: number;
  canvas: { w: number; h: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
  rooms: RoomRect[];  // 高亮区（可选，没有则用节点位置画小圈）
}

const STORAGE_KEY = 'taixu-layout';
export const LAYOUT_VERSION = 2;

// ----------------------------------------------------------------------------
// 默认布局（从 rooms.ts 的房间坐标 + 门洞转换成路点图）
// ----------------------------------------------------------------------------

/** 代码内置兜底布局：6 房间节点（相邻直连），无中转点。
 *  用户在编辑器里沿连线按需添加中转点（点线段即加，加完自动切选择模式）。 */
export function defaultLayout(): Layout {
  const nodes: GraphNode[] = [
    { id: 'n_study',   x: 216,  y: 180, roomId: 'study' },
    { id: 'n_work',    x: 640,  y: 180, roomId: 'workshop' },
    { id: 'n_lounge',  x: 640,  y: 528, roomId: 'lounge' },
    { id: 'n_social',  x: 216,  y: 528, roomId: 'social' },
    { id: 'n_arcade',  x: 1064, y: 528, roomId: 'arcade' },
    { id: 'n_private', x: 1064, y: 360, roomId: 'private' },
  ];
  // 相邻房间直连（隔墙的才连）：用户按需在线上加点绕开门洞
  const edges: GraphEdge[] = [
    { a: 'n_study',   b: 'n_work' },    // 书房↔工作室
    { a: 'n_work',    b: 'n_private' }, // 工作室↔卧室
    { a: 'n_social',  b: 'n_lounge' },  // 社交↔客厅
    { a: 'n_lounge',  b: 'n_arcade' },  // 客厅↔游戏区
    { a: 'n_study',   b: 'n_social' },  // 书房↔社交
    { a: 'n_work',    b: 'n_lounge' },  // 工作室↔客厅
    { a: 'n_private', b: 'n_arcade' },  // 卧室↔游戏区
  ];
  const rooms: RoomRect[] = ALL_ROOMS.map((r) => ({
    id: r.id, rect: { ...r.rect }, accent: r.accent.toString(16).padStart(6, '0'),
  }));
  return { version: LAYOUT_VERSION, canvas: { ...CANVAS }, nodes, edges, rooms };
}

// ----------------------------------------------------------------------------
// 存储
// ----------------------------------------------------------------------------

export function saveLayout(layout: Layout): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }
  catch { /* localStorage 不可用时静默 */ }
}

export function loadLayoutFromStorage(): Layout | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeLayout(JSON.parse(raw));
  } catch { return null; }
}

export function loadLayout(): Layout {
  return loadLayoutFromStorage() ?? defaultLayout();
}

export function exportLayoutJSON(layout: Layout, filename = 'layout.json'): void {
  const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/** 规范化任意半成品配置，避免脏数据崩溃。 */
export function normalizeLayout(raw: any): Layout {
  const dft = defaultLayout();
  if (!raw || typeof raw !== 'object') return dft;
  return {
    version: LAYOUT_VERSION,
    canvas: { w: num(raw.canvas?.w, dft.canvas.w), h: num(raw.canvas?.h, dft.canvas.h) },
    nodes: Array.isArray(raw.nodes) ? raw.nodes.filter(validNode).map((n: any) => ({
      id: String(n.id), x: num(n.x, 0), y: num(n.y, 0),
      roomId: typeof n.roomId === 'string' ? n.roomId : undefined,
    })) : dft.nodes,
    edges: Array.isArray(raw.edges) ? raw.edges.filter(validEdge).map((e: any) => ({ a: String(e.a), b: String(e.b) })) : dft.edges,
    rooms: Array.isArray(raw.rooms) ? raw.rooms.filter((r: any) => r && r.id).map((r: any) => ({
      id: String(r.id), rect: { x: num(r.rect?.x, 0), y: num(r.rect?.y, 0), w: num(r.rect?.w, 0), h: num(r.rect?.h, 0) },
      accent: typeof r.accent === 'string' ? r.accent : '888888',
    })) : dft.rooms,
  };
}
function validNode(n: any): boolean { return n && typeof n.id === 'string' && typeof n.x === 'number'; }
function validEdge(e: any): boolean { return e && typeof e.a === 'string' && typeof e.b === 'string'; }
function num(v: any, f: number): number { return typeof v === 'number' && isFinite(v) ? v : f; }

// ----------------------------------------------------------------------------
// 运行时查询（HouseScene 消费）
// ----------------------------------------------------------------------------

/** 取某房间的主节点（站位点）。找不到返回 null。 */
export function nodeForRoom(layout: Layout, roomId: string): GraphNode | null {
  return layout.nodes.find((n) => n.roomId === roomId) ?? null;
}

/** 取房间高亮矩形 + accent（转成数字）。 */
export function roomRect(layout: Layout, roomId: string): { rect: RoomRect['rect']; accent: number } | null {
  const r = layout.rooms.find((x) => x.id === roomId);
  if (!r) return null;
  return { rect: r.rect, accent: parseInt(r.accent, 16) };
}

/** 所有房间 id（有主节点的）。 */
export function roomIds(layout: Layout): string[] {
  return layout.nodes.filter((n) => n.roomId).map((n) => n.roomId!);
}

// ----------------------------------------------------------------------------
// 寻路：路点图 BFS
// ----------------------------------------------------------------------------

/**
 * 从 fromRoom 到 toRoom 的最短路径，返回途经节点坐标序列（含起终点）。
 * 例：study→arcade → [{216,180}, {420,180}, {640,180}, {640,348}, {640,528}, {860,528}, {1064,528}]。
 * 同房间返回 [起点]，找不到路返回 null。
 */
export function findPath(layout: Layout, fromRoom: string, toRoom: string): { x: number; y: number }[] | null {
  const start = nodeForRoom(layout, fromRoom);
  const end = nodeForRoom(layout, toRoom);
  if (!start || !end) return null;
  if (fromRoom === toRoom) return [{ x: start.x, y: start.y }];

  // 邻接表
  const adj: Record<string, string[]> = {};
  for (const e of layout.edges) {
    (adj[e.a] ??= []).push(e.b);
    (adj[e.b] ??= []).push(e.a);
  }
  // BFS
  const prev: Record<string, string | null> = { [start.id]: null };
  const queue: string[] = [start.id];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === end.id) break;
    for (const nxt of adj[cur] ?? []) {
      if (!(nxt in prev)) { prev[nxt] = cur; queue.push(nxt); }
    }
  }
  if (!(end.id in prev)) return null;
  // 回溯节点 id 序列
  const ids: string[] = [];
  let cur: string = end.id;
  while (cur) { ids.unshift(cur); const p = prev[cur]; if (p === null) break; cur = p; }
  // 转坐标
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));
  return ids.map((id) => byId.get(id)!).map((n) => ({ x: n.x, y: n.y }));
}

export type { RoomDef };
