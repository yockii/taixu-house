// ============================================================================
// 连接栏 —— 运行时切换 runtime 地址/端口
// ============================================================================
//
// 本机常同时跑多个生命 runtime（各占不同端口：3000/3001/3002…）。这个顶部小栏
// 让你随时填地址、一键连过去，不必靠 URL 参数重开页面。
//
// 纯 DOM 浮层，与 Phaser 画布并存。
// ============================================================================

export class ConnectBar {
  private input: HTMLInputElement;
  private dot: HTMLSpanElement;

  constructor(initialURL: string, private onConnect: (url: string) => void) {
    const bar = document.createElement('div');
    bar.style.cssText = [
      'position:fixed', 'top:10px', 'left:50%', 'transform:translateX(-50%)',
      'z-index:900', 'display:flex', 'gap:8px', 'align-items:center',
      'padding:6px 10px', 'background:rgba(26,26,34,0.92)',
      'border:1px solid #444', 'border-radius:8px', 'font-family:monospace',
    ].join(';');

    this.dot = document.createElement('span');
    this.dot.textContent = '○';
    this.dot.style.color = '#888';
    bar.appendChild(this.dot);

    this.input = document.createElement('input');
    this.input.value = initialURL;
    this.input.placeholder = 'http://localhost:3000';
    this.input.spellcheck = false;
    Object.assign(this.input.style, {
      width: '230px', padding: '6px 8px', background: '#11111a',
      border: '1px solid #444', borderRadius: '5px', color: '#e0e2ee',
      fontFamily: 'monospace', fontSize: '12px',
    });
    this.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.fire(); });
    bar.appendChild(this.input);

    const btn = document.createElement('button');
    btn.textContent = '连接';
    Object.assign(btn.style, {
      padding: '6px 14px', background: '#3a5fb0', border: 'none', borderRadius: '5px',
      color: '#fff', fontFamily: 'monospace', fontSize: '12px', cursor: 'pointer',
    });
    btn.addEventListener('click', () => this.fire());
    bar.appendChild(btn);

    document.body.appendChild(bar);
  }

  private fire() {
    const url = this.input.value.trim();
    if (url) this.onConnect(url);
  }

  /** 由场景回调更新连接状态指示。 */
  setStatus(ok: boolean) {
    this.dot.textContent = ok ? '●' : '○';
    this.dot.style.color = ok ? '#6fd8a0' : '#e08868';
  }
}
