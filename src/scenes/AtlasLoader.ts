// ============================================================================
// AtlasLoader —— 图集（atlas / spritesheet）加载与帧查询
// ============================================================================
//
// 把 sprite 管线从「只吃单图」升级到「吃 JSON 图集」，方便接入 LimeZu / Star Office
// 等真实像素素材包（它们通常是「一张大 PNG + JSON 帧坐标」）。
//
// 用法（在 HouseScene.preload 里）：
//   AtlasLoader.preload(this);   // 容错加载 assets/atlas/atlas.png + atlas.json
//
// 在绘制点查询：
//   if (AtlasLoader.has(scene, 'furniture/bookshelf')) { 用帧 } else { 程序化 }
//
// 帧命名约定（见 docs/ASSETS.md）：
//   furniture/<roomId>/<pieceName>   如 furniture/study/bookshelf
//   character/walk/<dir>/<frame>     如 character/walk/down/0
//   tiles/floor                       单图地砖（平铺用，复用旧槽位）
//
// 仓库不自带任何 atlas（.gitignore 掉 assets/），所以这些查询默认全部 miss、
// 走程序化兜底，保持「零版权、开箱即跑、永不破图」。
// ============================================================================

import Phaser from 'phaser';

/** atlas 的纹理 key。 */
export const ATLAS_KEY = 'taixu-atlas';
const ATLAS_PNG = 'atlas/atlas.png';
const ATLAS_JSON = 'atlas/atlas.json';

/** 在场景里容错加载 atlas（文件不存在时静默，不打断游戏）。 */
export function preload(scene: Phaser.Scene): void {
  scene.load.atlas(ATLAS_KEY, ATLAS_PNG, ATLAS_JSON);
  scene.load.on('loaderror', () => { /* 缺图静默 */ });
}

/** atlas 是否已加载可用。 */
export function available(scene: Phaser.Scene): boolean {
  return scene.textures.exists(ATLAS_KEY);
}

/**
 * 查询某个逻辑件名是否在 atlas 里存在对应帧。
 * @param name 逻辑名，如 'furniture/study/bookshelf'
 */
export function has(scene: Phaser.Scene, name: string): boolean {
  if (!available(scene)) return false;
  const texture = scene.textures.get(ATLAS_KEY);
  const frames = texture.getFrameNames();
  // 精确匹配，或前缀匹配（'furniture/bookshelf' 命中任意 'furniture/.../bookshelf'）
  if (frames.includes(name)) return true;
  return frames.some((f) => f === name || f.startsWith(name + '/') || f.endsWith('/' + name));
}

/**
 * 取某个逻辑件名的帧（用于 add.image 或 sprite）。
 * 找不到精确帧时，回退到任意前缀匹配的第一帧。
 * @returns [textureKey, frameName] 或 null（不可用）
 */
export function frame(scene: Phaser.Scene, name: string): [string, string] | null {
  if (!available(scene)) return null;
  const texture = scene.textures.get(ATLAS_KEY);
  const frames = texture.getFrameNames();
  if (frames.includes(name)) return [ATLAS_KEY, name];
  const prefix = frames.find((f) => f.startsWith(name + '/'));
  if (prefix) return [ATLAS_KEY, prefix];
  const suffix = frames.find((f) => f.endsWith('/' + name));
  if (suffix) return [ATLAS_KEY, suffix];
  return null;
}

/**
 * 取一组帧（用于行走动画等多帧件）。
 * @param namePrefix 如 'character/walk/down'
 * @returns 按帧名排序后的 [textureKey, frameName][] 数组（可能为空）
 */
export function frames(scene: Phaser.Scene, namePrefix: string): [string, string][] {
  if (!available(scene)) return [];
  const texture = scene.textures.get(ATLAS_KEY);
  return texture
    .getFrameNames()
    .filter((f) => f.startsWith(namePrefix))
    .sort()
    .map((f) => [ATLAS_KEY, f] as [string, string]);
}
