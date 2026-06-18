// ============================================================================
// 房间映射 —— 消费端自定义维度（中立性的证明）
// ============================================================================
//
// 注意：「房间」这个概念**不在 SDK 里**。runtime 只告诉你生命当前的活动域
// (domain: reflect/social/knowledge/play/create)，至于把它画成房间、时间线、
// 仪表盘还是别的——完全是消费端的自由。
//
// 本文件只定义「domain → 背景图上的像素坐标」。背景图(office_bg.png)画好了一切
// 墙壁/地板/家具，这里只负责告诉代码「生命在书房时该站在哪个像素」。
// ============================================================================

import type { Domain } from './sdk';

/** 画布尺寸（与 office_bg.png 对应，Phaser 视口）。 */
export const CANVAS = { w: 1280, h: 720 };

export interface RoomDef {
  id: string;
  name: string;
  domain: Domain;
  /** 小人在背景图上的落脚点（像素，1280×720 坐标系）。 */
  x: number;
  y: number;
  /** 房间高亮区域（像素矩形，用于 presence 高亮/点击）。 */
  rect: { x: number; y: number; w: number; h: number };
  /** 主题强调色（高亮描边/名牌用）。 */
  accent: number;
}

// 坐标基于 docs/BG-PROMPT.md 的精确布局，三列两行 + 卧室通高。
// 背景(office_bg.png)已按此布局生成，代码坐标与之对齐。
export const ROOMS: RoomDef[] = [
  { id: 'study',    name: '书房',   domain: 'knowledge', x: 216,  y: 180, rect: { x: 24,  y: 24,  w: 384, h: 312 }, accent: 0xe0a868 },
  { id: 'workshop', name: '工作室', domain: 'create',    x: 640,  y: 180, rect: { x: 432, y: 24,  w: 416, h: 312 }, accent: 0x6fd8a0 },
  { id: 'lounge',   name: '客厅',   domain: 'reflect',   x: 640,  y: 528, rect: { x: 432, y: 360, w: 416, h: 336 }, accent: 0xb0b0c0 },
  { id: 'social',   name: '社交区', domain: 'social',    x: 216,  y: 528, rect: { x: 24,  y: 360, w: 384, h: 336 }, accent: 0x6fa8dc },
  { id: 'arcade',   name: '游戏区', domain: 'play',      x: 1064, y: 528, rect: { x: 872, y: 360, w: 384, h: 336 }, accent: 0xc06fd8 },
];

const BY_DOMAIN: Record<Domain, RoomDef> = ROOMS.reduce((acc, r) => {
  acc[r.domain] = r;
  return acc;
}, {} as Record<Domain, RoomDef>);

/** 把 SDK 的活动域映射到小屋的房间。未知域兜底到客厅。 */
export function roomForDomain(d: Domain): RoomDef {
  return BY_DOMAIN[d] ?? BY_DOMAIN['reflect'];
}

// 私密房间：**不是活动域**，生命不会因任何工具走进来。它是 UI 固定设施——
// token 解锁后的私密只读内容(thought/对话) + 交互(对话生命)的入口。
export const PRIVATE_ROOM: RoomDef = {
  id: 'private', name: '私密 🔒', domain: 'reflect' as Domain,
  x: 1064, y: 360,
  rect: { x: 872, y: 24, w: 384, h: 672 },
  accent: 0xd86f9f,
};

export const ALL_ROOMS: RoomDef[] = [...ROOMS, PRIVATE_ROOM];

// ============================================================================
// 房间连通图 + 门洞坐标（用于寻路）
// ============================================================================
//
// 背景图把墙和门洞画死了。这里定义「哪些房间相邻」+「门洞在墙上的像素中点」。
// 寻路时小人走：起点房间 → 门洞 → ... → 门洞 → 终点房间，不穿墙。
// 门洞坐标基于背景图布局（见 docs/BG-PROMPT.md 的墙/门规格）。
// ============================================================================

export interface Edge {
  a: string; b: string;        // 相邻的两个房间 id
  /** 门洞在背景图上的像素中点（小人穿过此点往返两间房）。 */
  door: { x: number; y: number };
  /** 是否开放连通（无墙，如客厅↔游戏区）。开放边走中点即可，无门洞感。 */
  open?: boolean;
}

/**
 * 房间连通图。每条边 = 一堵带门洞的墙（或开放连通）。
 * 坐标基于 1280×720 背景图：
 *   竖墙门洞 x≈420(左列/中列)、x≈860(中列/右列)
 *   横墙门洞 y≈348(上行/下行)
 */
export const EDGES: Edge[] = [
  // 上行内部
  { a: 'study',    b: 'workshop', door: { x: 420, y: 180 } }, // 书房↔工作室
  { a: 'workshop', b: 'private',  door: { x: 860, y: 180 } }, // 工作室↔卧室
  // 下行内部
  { a: 'social',   b: 'lounge',   door: { x: 420, y: 528 } }, // 社交区↔客厅
  { a: 'lounge',   b: 'arcade',   door: { x: 860, y: 528 }, open: true }, // 客厅↔游戏区(开放)
  // 上下行连通（横墙门洞）
  { a: 'study',    b: 'social',   door: { x: 216, y: 348 } }, // 书房↔社交区
  { a: 'workshop', b: 'lounge',   door: { x: 640, y: 348 } }, // 工作室↔客厅
  { a: 'private',  b: 'arcade',   door: { x: 1064, y: 348 } }, // 卧室↔游戏区
];

/** 取某房间 id 的定义（基于默认布局）。运行时坐标请用 layout.ts 的 resolveRooms。 */
export function roomById(id: string): RoomDef | undefined {
  return ALL_ROOMS.find((r) => r.id === id);
}

// 寻路逻辑已迁至 src/layout.ts（findDoorPath），改为消费可配置的 layout.edges。

