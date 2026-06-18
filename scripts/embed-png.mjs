// ============================================================================
// embed-png.mjs —— 把 layout.json 嵌入 PNG 的 tEXt chunk
// ============================================================================
//
// 用法：
//   node scripts/embed-png.mjs <背景图.png> <layout.json> [输出.png]
//
// 例：
//   node scripts/embed-png.mjs public/assets/office_bg.png layout.json
//   → 生成 office_bg.with-layout.png（原图 + taixu-layout 元数据）
//
// 原理：PNG 由一系列 chunk 组成（IHDR/IDAT/.../IEND）。tEXt chunk 格式：
//   4字节长度 + "tEXt" + "key\0value" + 4字节CRC
// 本脚本在 IHDR 之后、第一个 IDAT 之前插入一个 tEXt chunk，不改动任何像素数据。
// 无损：输出的 PNG 和原图像素完全一致，只多了一段元数据。
//
// 运行时（pngMeta.ts 的 readTaixuLayout）能读回这个 chunk 作为布局配置。
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

// 拼一个 tEXt chunk：长度 + 类型 + 数据 + CRC
function textChunk(key, value) {
  const data = Buffer.concat([Buffer.from(key + '\0', 'latin1'), Buffer.from(value, 'utf8')]);
  const type = Buffer.from('tEXt', 'latin1');
  const crc = crc32(Buffer.concat([type, data]));
  return Buffer.concat([u32(data.length), type, data, u32(crc)]);
}

function embed(pngPath, jsonPath, outPath) {
  const png = readFileSync(pngPath);
  const json = readFileSync(jsonPath, 'utf8');
  const layout = JSON.parse(json);
  // 校验签名
  if (png.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('不是有效的 PNG 文件');
  }
  // 找 IHDR 结束位置（IHDR 固定 13 字节数据），在其后插入 tEXt
  // 结构：8签名 + 4长度 + 4"IHDR" + 13数据 + 4CRC = 33
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  const before = png.slice(0, ihdrEnd);
  const after = png.slice(ihdrEnd);
  const chunk = textChunk('taixu-layout', JSON.stringify(layout));
  const out = Buffer.concat([before, chunk, after]);
  const finalOut = outPath || pngPath.replace(/\.png$/i, '.with-layout.png');
  writeFileSync(finalOut, out);
  console.log(`✓ 已嵌入 taixu-layout 到 ${finalOut}`);
  console.log(`  原图 ${png.length} 字节 → 输出 ${out.length} 字节（+${out.length - png.length}）`);
  console.log(`  嵌入的配置：${layout.nodes?.length || 0} 节点，${layout.edges?.length || 0} 连线`);
}

const [,, png, json, out] = process.argv;
if (!png || !json) {
  console.error('用法: node scripts/embed-png.mjs <背景图.png> <layout.json> [输出.png]');
  process.exit(1);
}
embed(png, json, out);
