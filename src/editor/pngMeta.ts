// ============================================================================
// pngMeta —— 读取 PNG tEXt chunk（可选的布局配置嵌入）
// ============================================================================
//
// PNG 支持在文件里嵌入文本元数据（tEXt chunk）。如果背景图带 `taixu-layout`
// 键，编辑器/运行时可读取它作为布局配置来源（优先级低于 localStorage）。
//
// 浏览器只读不写（写不了用户磁盘）。本文件只提供读取。
// tEXt chunk 结构：4字节长度 + "tEXt" + "key\0value" + 4字节CRC。
// ============================================================================

/** 从 PNG 文件的 ArrayBuffer 里读所有 tEXt chunk，返回 {key: value}。 */
export function readPngTextChunks(data: ArrayBuffer): Record<string, string> {
  const bytes = new Uint8Array(data);
  // 校验 PNG 签名
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== SIG[i]) return {};
  const result: Record<string, string> = {};
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = (bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3];
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    off += 8;
    if (type === 'tEXt') {
      // "key\0value"
      const chunk = bytes.subarray(off, off + len);
      const nul = chunk.indexOf(0);
      if (nul > 0) {
        const key = new TextDecoder().decode(chunk.subarray(0, nul));
        const value = new TextDecoder().decode(chunk.subarray(nul + 1));
        result[key] = value;
      }
    }
    off += len + 4; // 数据 + CRC
    if (type === 'IEND') break;
  }
  return result;
}

/** 读取 PNG 里嵌入的 taixu-layout（若有）。返回解析后的对象或 null。 */
export function readTaixuLayout(data: ArrayBuffer): unknown | null {
  const chunks = readPngTextChunks(data);
  const raw = chunks['taixu-layout'];
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
