// ============================================================================
// 私密房间面板 —— token 解锁 + 私密只读内容 + 交互
// ============================================================================
//
// 公开访客看到的是一扇锁着的门（房间内只有 🔒）。点击 → 弹出本面板：
//   · 未持令牌：输入访问令牌「解锁」。
//   · 已解锁：看到 privileged 内容（内心独白 thought 流 / 对话历史）+ 可与生命对话。
//
// 这对应 runtime 的 R87 分级鉴权：presence/vitals/act 公开（剪影行为可见），
// thought 与「写」交互需令牌。私密房间就是把这些 token-gated 的东西收纳到一处。
//
// 用 HTML 浮层而非 Phaser 画——演示 canvas + DOM 混合：游戏感的部分交给引擎，
// 表单/文本交互交给原生 DOM，各取所长。
// ============================================================================

import type { LifeClient, Thought } from './sdk';
import { t } from './i18n';

const KIND_ICON: Record<string, string> = {
  speech: '💬', reflection: '✨', intent: '🎯', memory: '📎',
};

export class PrivatePanel {
  private root: HTMLDivElement;
  private bodyEl!: HTMLDivElement;
  private thoughtLog?: HTMLDivElement;
  private open = false;
  private unlocked = false; // 用户已点「解锁」（本地生命留空也算解锁；与是否持令牌解耦）

  constructor(private client: LifeClient, private onUnlock: (token: string) => void) {
    this.root = document.createElement('div');
    this.root.style.cssText = [
      'position:fixed', 'inset:0', 'display:none', 'z-index:1000',
      'background:rgba(8,8,12,0.72)', 'backdrop-filter:blur(2px)',
      'align-items:center', 'justify-content:center',
      'font-family:monospace',
    ].join(';');
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });
    document.body.appendChild(this.root);
  }

  isOpen() {
    return this.open;
  }

  show() {
    this.open = true;
    this.root.style.display = 'flex';
    this.render();
  }

  close() {
    this.open = false;
    this.root.style.display = 'none';
    this.thoughtLog = undefined;
  }

  /** 实时 thought：面板开着且已解锁时追加到内心独白。 */
  pushThought(t: Thought) {
    if (!this.open || !this.thoughtLog) return;
    this.appendThought(t);
  }

  private render() {
    const authed = this.unlocked;
    this.root.innerHTML = '';
    const card = el('div', {
      width: 'min(560px, 92vw)', maxHeight: '84vh', overflow: 'auto',
      background: '#1a1a22', border: '2px solid #6f8fd8', borderRadius: '10px',
      padding: '20px', color: '#e0e2ee', boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
    });

    const head = el('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' });
    head.appendChild(el('div', { fontSize: '17px', color: '#9fb6ec' }, authed ? t('panel.titleUnlocked') : t('panel.titleLocked')));
    const closeBtn = btn('✕', () => this.close());
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#888';
    head.appendChild(closeBtn);
    card.appendChild(head);

    this.bodyEl = el('div', {});
    card.appendChild(this.bodyEl);
    this.root.appendChild(card);

    if (!authed) this.renderUnlock();
    else this.renderUnlocked();
  }

  private renderUnlock() {
    this.bodyEl.appendChild(el('div', { color: '#aab', fontSize: '13px', lineHeight: '1.6', marginBottom: '14px', whiteSpace: 'pre-line' },
      t('panel.intro')));

    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = t('panel.tokenPlaceholder');
    Object.assign(input.style, {
      width: '100%', boxSizing: 'border-box', padding: '10px', marginBottom: '12px',
      background: '#11111a', border: '1px solid #444', borderRadius: '6px',
      color: '#e0e2ee', fontFamily: 'monospace', fontSize: '13px',
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') unlock(); });
    this.bodyEl.appendChild(input);

    const unlock = () => {
      this.unlocked = true;
      this.client.setToken(input.value.trim()); // 留空=本地生命无需令牌（thought 仍全量推送）
      this.onUnlock(input.value.trim());        // 让场景带令牌重连事件流
      this.render();
    };
    const b = btn(t('panel.unlock'), unlock);
    b.style.width = '100%';
    this.bodyEl.appendChild(b);
  }

  private renderUnlocked() {
    // 对话交互
    this.bodyEl.appendChild(section(t('panel.talkTitle')));
    const ta = document.createElement('textarea');
    ta.placeholder = t('panel.talkPlaceholder');
    Object.assign(ta.style, {
      width: '100%', boxSizing: 'border-box', height: '60px', padding: '10px',
      background: '#11111a', border: '1px solid #444', borderRadius: '6px',
      color: '#e0e2ee', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical',
    });
    this.bodyEl.appendChild(ta);
    const sendRow = el('div', { display: 'flex', gap: '8px', margin: '8px 0 18px' });
    const status = el('span', { color: '#888', fontSize: '12px', alignSelf: 'center' });
    const send = btn(t('panel.send'), async () => {
      const text = ta.value.trim();
      if (!text) return;
      status.textContent = t('panel.sending');
      try {
        await this.client.talk(text);
        ta.value = '';
        status.textContent = t('panel.sent');
      } catch (err) {
        status.textContent = t('panel.sendFail') + (err as Error).message;
      }
    });
    sendRow.appendChild(send);
    sendRow.appendChild(status);
    this.bodyEl.appendChild(sendRow);

    // 内心独白（实时 thought）
    this.bodyEl.appendChild(section(t('panel.monologueTitle')));
    this.thoughtLog = el('div', {
      maxHeight: '180px', overflow: 'auto', padding: '8px',
      background: '#11111a', border: '1px solid #333', borderRadius: '6px',
      fontSize: '12px', lineHeight: '1.7',
    });
    this.bodyEl.appendChild(this.thoughtLog);

    // 用快照里的最近 thoughts 先填充
    this.client.snapshot().then((snap) => {
      if (!this.thoughtLog) return;
      if (!snap.thoughts?.length) {
        this.thoughtLog.appendChild(el('div', { color: '#666' }, t('panel.monologueEmpty')));
        return;
      }
      for (const t of snap.thoughts) this.appendThought(t);
    }).catch(() => {
      if (this.thoughtLog) {
        this.thoughtLog.appendChild(el('div', { color: '#e08868' }, t('panel.readFail')));
      }
    });
  }

  private appendThought(t: Thought) {
    if (!this.thoughtLog) return;
    const icon = KIND_ICON[t.kind] ?? '💬';
    const line = el('div', { marginBottom: '6px', color: '#cdd2e6' }, `${icon} ${t.text}`);
    this.thoughtLog.appendChild(line);
    this.thoughtLog.scrollTop = this.thoughtLog.scrollHeight;
  }
}

// --- DOM 小工具 ---
function el(tag: string, style: Partial<CSSStyleDeclaration> | Record<string, string>, text?: string): HTMLDivElement {
  const e = document.createElement(tag) as HTMLDivElement;
  Object.assign(e.style, style);
  if (text) e.textContent = text;
  return e;
}
function section(title: string): HTMLDivElement {
  return el('div', { color: '#9fb6ec', fontSize: '13px', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }, title);
}
function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  Object.assign(b.style, {
    padding: '9px 16px', background: '#3a5fb0', border: 'none', borderRadius: '6px',
    color: '#fff', fontFamily: 'monospace', fontSize: '13px', cursor: 'pointer',
  });
  b.addEventListener('click', onClick);
  return b;
}
