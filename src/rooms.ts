// ============================================================================
// 房间映射 —— 消费端自定义维度（中立性的证明）
// ============================================================================
//
// 注意：「房间」这个概念**不在 SDK 里**。runtime 只告诉你生命当前的活动域
// (domain: reflect/social/knowledge/play/create)，至于把它画成房间、时间线、
// 仪表盘还是别的——完全是消费端的自由。
//
// 这个文件就是「太虚小屋」选择的表现维度：把 5 个活动域映射成 5 个房间。
// 换一个开发者完全可以删掉本文件、用另一套维度。SDK 不会变。
// ============================================================================

import type { Domain } from './sdk';

export interface RoomDef {
  id: string;
  name: string;
  domain: Domain;
  /** 网格坐标（列、行），由场景换算成像素。 */
  col: number;
  row: number;
  /** 房间主题色（像素风调色板）。 */
  color: number;
  accent: number;
}

// 3 列 × 2 行平面布局（俯视单层）：上排 社交/书房/游戏，下排 工坊/休息/私密。
export const ROOMS: RoomDef[] = [
  { id: 'social', name: '社交区', domain: 'social', col: 0, row: 0, color: 0x2a3b5c, accent: 0x6fa8dc },
  { id: 'study', name: '书房', domain: 'knowledge', col: 1, row: 0, color: 0x4a3b2a, accent: 0xe0a868 },
  { id: 'arcade', name: '游戏区', domain: 'play', col: 2, row: 0, color: 0x3b2a4a, accent: 0xc06fd8 },
  { id: 'workshop', name: '工坊', domain: 'create', col: 0, row: 1, color: 0x2a4a3b, accent: 0x6fd8a0 },
  { id: 'lounge', name: '休息·数据', domain: 'reflect', col: 1, row: 1, color: 0x3a3a42, accent: 0xb0b0c0 },
];

const BY_DOMAIN: Record<Domain, RoomDef> = ROOMS.reduce((acc, r) => {
  acc[r.domain] = r;
  return acc;
}, {} as Record<Domain, RoomDef>);

/** 把 SDK 的活动域映射到小屋的房间。未知域兜底到休息区。 */
export function roomForDomain(d: Domain): RoomDef {
  return BY_DOMAIN[d] ?? BY_DOMAIN['reflect'];
}

// 私密房间：**不是活动域**，生命不会因任何工具走进来。它是 UI 固定设施——
// token 解锁后的私密只读内容(thought/对话) + 交互(对话生命)的入口。占网格 (col1,row2)。
export const PRIVATE_ROOM = {
  id: 'private', name: '私密 🔒', col: 2, row: 1, color: 0x4a2a3b, accent: 0xd86f9f,
};

export const GRID_COLS = 3;
export const GRID_ROWS = 2;
