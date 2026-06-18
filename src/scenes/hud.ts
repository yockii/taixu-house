// ============================================================================
// Hud —— DOM 文字层（vitals / 技能 / 状态 / 意图 / 思考气泡）
// ============================================================================
//
// 所有 UI 文字用 DOM 元素渲染，叠在 Phaser 画布之上。这样文字永远清晰，
// 不受画布缩放/像素化影响（这是 star-office-ui 路线的核心优势）。
// 与 connectBar / privatePanel 一致，都是「canvas 画场景 + DOM 画交互」的混合。
// ============================================================================

import { t } from '../i18n';

export class Hud {
  private root: HTMLDivElement;
  private statusEl: HTMLSpanElement;
  private titleEl: HTMLDivElement;
  private intentEl: HTMLDivElement;
  private vitalsEl: HTMLPreElement;
  private shelfEl: HTMLPreElement;
  private bubbleEl: HTMLDivElement;
  private bubbleTimer: number | undefined;

  constructor() {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed', 'inset:0', 'pointer-events:none', 'z-index:800',
      'font-family:monospace', 'color:#e0e2ee',
    ].join(';');

    // 标题：左上角（避开顶部居中的连接栏）
    this.titleEl = document.createElement('div');
    this.titleEl.textContent = t('title');
    this.titleEl.style.cssText = 'position:absolute;top:14px;left:16px;font-size:15px;color:#9fb6ec;';
    this.root.appendChild(this.titleEl);

    // 标题下方：外部门户（太虚文明 / 太虚生命）
    // root 设了 pointer-events:none，链接须显式 auto 才能点击；hover 时提亮。
    const links = document.createElement('div');
    links.style.cssText = 'position:absolute;top:38px;left:16px;font-size:11px;display:flex;gap:8px;align-items:center;';
    const mkPortal = (text: string, href: string, color: string, hover: string) => {
      const a = document.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = text;
      a.style.cssText = `color:${color};text-decoration:none;opacity:0.75;pointer-events:auto;transition:opacity .12s,color .12s;`;
      a.addEventListener('mouseenter', () => { a.style.opacity = '1'; a.style.color = hover; });
      a.addEventListener('mouseleave', () => { a.style.opacity = '0.75'; a.style.color = color; });
      return a;
    };
    links.appendChild(mkPortal('太虚文明', 'https://taixu.icu', '#9fb6ec', '#cdd9f7'));
    const sep = document.createElement('span');
    sep.textContent = '·'; sep.style.color = '#555';
    links.appendChild(sep);
    links.appendChild(mkPortal('太虚生命', 'https://yockii.github.io/taixu-runtime', '#cdebd6', '#e8f7ee'));
    this.root.appendChild(links);

    // 状态：右上角
    this.statusEl = document.createElement('span');
    this.statusEl.textContent = t('status.connecting');
    this.statusEl.style.cssText = 'position:absolute;top:16px;right:16px;font-size:13px;color:#e0c068;';
    this.root.appendChild(this.statusEl);

    // 左下：vitals（状态条）
    this.vitalsEl = document.createElement('pre');
    this.vitalsEl.style.cssText = [
      'position:absolute', 'left:14px', 'bottom:14px', 'margin:0',
      'padding:8px 10px', 'background:rgba(20,16,24,0.72)',
      'border:1px solid #333', 'border-radius:6px',
      'font-size:12px', 'line-height:1.6', 'color:#f0e6d2',
      'white-space:pre',
    ].join(';');
    this.root.appendChild(this.vitalsEl);

    // 右下：技能货架
    this.shelfEl = document.createElement('pre');
    this.shelfEl.style.cssText = [
      'position:absolute', 'right:14px', 'bottom:14px', 'margin:0',
      'padding:8px 10px', 'background:rgba(20,16,24,0.72)',
      'border:1px solid #333', 'border-radius:6px',
      'font-size:11px', 'line-height:1.6', 'color:#cdebd6',
      'white-space:pre', 'max-width:220px', 'overflow:hidden',
    ].join(';');
    this.shelfEl.textContent = '🗄 ' + t('shelf.loading');
    this.root.appendChild(this.shelfEl);

    // 底部意图
    this.intentEl = document.createElement('div');
    this.intentEl.style.cssText = [
      'position:absolute', 'bottom:14px', 'left:50%', 'transform:translateX(-50%)',
      'font-size:13px', 'color:#c9b89a', 'text-align:center',
      'max-width:60%', 'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis',
    ].join(';');
    this.root.appendChild(this.intentEl);

    // 思考气泡（默认隐藏，居中偏上）
    this.bubbleEl = document.createElement('div');
    this.bubbleEl.style.cssText = [
      'position:absolute', 'left:50%', 'top:64px', 'transform:translateX(-50%)',
      'padding:8px 14px', 'background:#fdf6e8', 'color:#3a2a1a',
      'border:2px solid #3a2a1a', 'border-radius:10px',
      'font-size:13px', 'max-width:340px', 'text-align:center',
      'box-shadow:0 4px 14px rgba(0,0,0,0.4)', 'display:none',
    ].join(';');
    this.root.appendChild(this.bubbleEl);

    document.body.appendChild(this.root);
  }

  setStatus(text: string, color: string) {
    this.statusEl.textContent = text;
    this.statusEl.style.color = color;
  }

  setIntent(text: string) {
    this.intentEl.textContent = text;
  }

  setVitals(lines: string[]) {
    this.vitalsEl.textContent = lines.join('\n');
  }

  setShelf(names: string[]) {
    this.shelfEl.textContent = '🗄 ' + (names.length ? names.join('\n   ') : t('shelf.empty'));
  }

  showBubble(text: string, ms: number) {
    this.bubbleEl.textContent = text;
    this.bubbleEl.style.display = 'block';
    if (this.bubbleTimer !== undefined) window.clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => { this.bubbleEl.style.display = 'none'; }, ms);
  }

  destroy() {
    if (this.bubbleTimer !== undefined) window.clearTimeout(this.bubbleTimer);
    this.root.remove();
  }
}
