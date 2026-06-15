// ============================================================================
// 太虚 Life SDK 客户端 —— 参考实现
// ============================================================================
//
// 这是对接太虚数字生命 runtime 的**最小、框架无关**参考实现。纯 TypeScript，
// 不依赖 Phaser 或任何 UI 框架——你可以原样拷进 React / Vue / Svelte / 原生项目。
//
// runtime 在 /api/live/* 暴露一套**中立、版本化**的生命事件契约（详见 runtime 的
// `GET /api/live/schema` 自描述端点）。核心理念：
//
//   SDK 只告诉你「生命在做什么类型的事」(domain) 和「它的状态/想法」，
//   绝不规定「你该怎么画」。房间、时间线、仪表盘、3D avatar、纯文字流——随你。
//
// 本文件就是「怎么接」的范本；taixu-house 的小屋 UI 只是「怎么用」的一种示范。
// ============================================================================

/** 活动域：生命当前在做的事的**语义分类**（对齐生命 drive），非 UI 结构。 */
export type Domain = 'reflect' | 'social' | 'knowledge' | 'play' | 'create';

/** presence：生命当前的活动域 + 触发它的原始工具 + 当前意图。 */
export interface Presence {
  domain: Domain;
  tool: string;   // 触发当前活动域的原始工具名，可空
  intent: string; // 当前目标意图文本，可空
  since: number;  // 进入该活动域的 unix 时间
}

/** vitals：生命的生物 + 心理状态标量（多数 [0,1]，wealth 为本地缓存货币）。 */
export interface Vitals {
  energy: number;
  social_need: number;
  stress: number;
  confidence: number;
  stability: number;
  competence: number;
  motivation: number;
  satisfaction: number;
  anxiety: number;
  wealth: number; // 灵韵：本地缓存值，平台为权威账本，仅供表现层近似显示
  at: number;
}

/** thought：生命的一段话语 / 反思 / 意图 / 记忆（含正文，需鉴权才推送）。 */
export interface Thought {
  kind: 'speech' | 'reflection' | 'intent' | 'memory';
  text: string;
  at: number;
}

/** act：一次工具调用（无正文，公开可见，适合触发一次动作/动画）。 */
export interface Act {
  domain: Domain;
  tool: string;
  ok: boolean;
  at: number;
}

export interface LifeHandlers {
  presence?: (p: Presence) => void;
  vitals?: (v: Vitals) => void;
  thought?: (t: Thought) => void;
  act?: (a: Act) => void;
  open?: () => void;
  error?: (e: Event) => void;
}

export interface Snapshot {
  version: string;
  presence: Presence;
  vitals: Vitals;
  thoughts: Thought[]; // 仅鉴权连接返回；公开连接为空数组
}

/**
 * LifeClient —— 连接一个 runtime、消费其 Life SDK 事件流。
 *
 * @param baseURL runtime 根地址，如 http://localhost:3000
 * @param token   访问令牌（可选）。本地未配令牌时留空即可（全量推送）。
 *                公网部署若配了令牌：不带 = 只能看 presence/vitals/act（剪影行为），
 *                看不到 thought（生命的话语/内心，属隐私）。
 */
export class LifeClient {
  private es: EventSource | null = null;

  constructor(private baseURL: string, private token?: string) {
    this.baseURL = baseURL.replace(/\/$/, '');
  }

  /** 拉一次性首屏快照（当前 presence + vitals + 最近 thoughts）。UI 启动时先调它渲染初态。 */
  async snapshot(): Promise<Snapshot> {
    const res = await fetch(this.url('/api/live/snapshot'), { headers: this.headers() });
    if (!res.ok) throw new Error(`snapshot ${res.status}`);
    return res.json();
  }

  /** 拉契约自描述（版本 / 活动域词表 / 事件清单）。用于版本协商或动态适配。 */
  async schema(): Promise<unknown> {
    const res = await fetch(this.url('/api/live/schema'), { headers: this.headers() });
    if (!res.ok) throw new Error(`schema ${res.status}`);
    return res.json();
  }

  /** 是否已持有令牌（决定私密内容/交互是否可用）。 */
  get authenticated(): boolean {
    return !!this.token;
  }

  /** 设置/更新令牌（私密房间「解锁」后调用，随后 reconnect 才能收到 thought 等隐私事件）。 */
  setToken(token: string) {
    this.token = token || undefined;
  }

  /** 切换 runtime 地址（连不同端口/不同生命）。调用方随后应 reconnect。 */
  setBaseURL(url: string) {
    this.baseURL = url.replace(/\/$/, '');
  }

  /** 当前 runtime 根地址。 */
  get url0(): string {
    return this.baseURL;
  }

  /** 拉对话历史（私密只读：人与生命的往来）。需令牌（公网时）。 */
  async dialogue(limit = 30): Promise<unknown[]> {
    const res = await fetch(this.url(`/api/dialogue?limit=${limit}`), { headers: this.headers() });
    if (!res.ok) throw new Error(`dialogue ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  /**
   * 给生命发一条消息（交互）。走 /api/external-request —— 慎思感知 + 反射即时回应。
   * 这是「写」操作：runtime 配了令牌时**必须**带令牌（withAuth），否则 401。
   */
  async talk(content: string, from = 'house', channel = 'web'): Promise<void> {
    const res = await fetch(this.url('/api/external-request'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers() },
      body: JSON.stringify({ from, channel, chat_type: 'direct', content }),
    });
    if (!res.ok) throw new Error(`talk ${res.status}`);
  }

  /** 拉生命已上架的技能（货架）。复用 runtime 既有 /api/skills。 */
  async skills(): Promise<unknown[]> {
    try {
      const res = await fetch(this.url('/api/skills'), { headers: this.headers() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.skills ?? data.items ?? []);
    } catch {
      return [];
    }
  }

  /**
   * 订阅实时事件流（SSE）。返回断连函数。
   *
   * 注意：浏览器 EventSource 不能带自定义 header，故令牌通过 ?token= 查询参数传递
   * （与 runtime 的 X-Taixu-Token 同值校验）。
   */
  connect(h: LifeHandlers): () => void {
    const url = new URL(this.url('/api/live/stream'));
    if (this.token) url.searchParams.set('token', this.token);
    const es = new EventSource(url.toString());
    this.es = es;

    es.onopen = () => h.open?.();
    es.onerror = (e) => h.error?.(e);

    if (h.presence) es.addEventListener('presence', (e) => h.presence!(JSON.parse((e as MessageEvent).data)));
    if (h.vitals) es.addEventListener('vitals', (e) => h.vitals!(JSON.parse((e as MessageEvent).data)));
    if (h.thought) es.addEventListener('thought', (e) => h.thought!(JSON.parse((e as MessageEvent).data)));
    if (h.act) es.addEventListener('act', (e) => h.act!(JSON.parse((e as MessageEvent).data)));

    return () => this.disconnect();
  }

  disconnect() {
    this.es?.close();
    this.es = null;
  }

  private url(path: string): string {
    return this.baseURL + path;
  }

  private headers(): Record<string, string> {
    return this.token ? { 'X-Taixu-Token': this.token } : {};
  }
}
