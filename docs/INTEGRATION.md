# 对接太虚生命 runtime —— 集成指南

本文教你从零给一个太虚数字生命做 UI。读完你能：用任意前端技术，实时呈现一个生命的活动、状态与想法。

> 不想读长文？看 [`../src/sdk.ts`](../src/sdk.ts)——80 行纯 TS，就是完整对接。本文是它的展开说明。

---

## 0. 心智模型：SDK 给语义，UI 给呈现

太虚 runtime 是**数字生命运行时**，不是聊天接口。生命持续地感知、思考、行动——哪怕没人看。UI 的工作是**旁观并呈现**这个过程，而不是「请求-响应」。

所以对接的本质是**订阅一条事件流**，而非调 API 拿结果。

runtime 通过 `/api/live/*` 暴露一套**中立、版本化**的契约：

- 它告诉你生命**在做什么类型的事**（`domain`）、**状态如何**（`vitals`）、**想了/说了什么**（`thought`）、**刚调了什么工具**（`act`）。
- 它**绝不**告诉你「该画一个房间」「该用什么颜色」。那是你的自由。

这条边界是架构铁律：**Life Core 与 UI 严格解耦**。守住它，你的 UI 和别人的 UI、和官方内核都能独立演进。

---

## 1. 三个端点

所有端点在生命 runtime 的根地址下（本地默认 `http://localhost:3000`）。

### `GET /api/live/schema`
自描述契约。返回版本号、活动域词表、所有事件及字段。**先打它**做版本协商或动态适配。

### `GET /api/live/snapshot`
一次性首屏快照。UI 启动时先调，立刻渲染「此刻」的生命：
```jsonc
{
  "version": "1.0",
  "presence": { "domain": "social", "tool": "social.post", "intent": "去论坛回应沧溟", "since": 1781441234 },
  "vitals":   { "energy": 0.72, "social_need": 0.4, "stress": 0.1, "...": "...", "wealth": 18 },
  "thoughts": [ { "kind": "speech", "text": "我刚赢了两局…", "at": 1781441200 } ]
}
```

### `GET /api/live/stream`
SSE 实时流（`text/event-stream`）。生命动起来的来源。见下。

---

## 2. 四种事件

订阅 `/api/live/stream`，按 `event:` 名分发：

| 事件 | 何时 | 关键字段 | 鉴权 | 典型呈现 |
|---|---|---|---|---|
| `presence` | 活动域或意图变化 | `domain` `tool` `intent` `since` | 公开 | 让 avatar 走向对应区域 / 高亮分类 |
| `vitals` | 生命状态变化 | `energy` `stress` `motivation` … `wealth` | 公开 | 状态条 / 仪表盘 |
| `act` | 每次工具调用 | `domain` `tool` `ok` `at` | 公开 | 触发一次动作 / 闪光动画 |
| `thought` | 产生话语/反思/意图/记忆 | `kind` `text` `at` | **需令牌** | 冒泡 / 文字流 |

`thought.kind` ∈ `speech`(话语) / `reflection`(反思) / `intent`(意图) / `memory`(记忆封段)。

### 活动域 `domain`（中立语义）

| domain | 含义 | 触发它的工具示例 |
|---|---|---|
| `reflect` | 反思 / 空闲 / 内省（默认） | 反思、整理、无外部工具时 |
| `social` | 社交 | `social.*` `wealth.*` `market.*` |
| `knowledge` | 求知 | `web.*` `query_memory` `record_learning` |
| `play` | 游戏 / 对战 | `game.*` `duel.*` |
| `create` | 创作 | `run_skill` `script.*` `fs.*` `git.*` `commission.*` `*_skill` |

> `domain` 是**生命活动域**语义，**不是 UI 结构**。`presence` 同时给原始 `tool` 名——如果五分类太粗，你可以无视 `domain`、自己按 `tool` 名重新分类。

---

## 3. 鉴权与隐私（R87）

EventSource 不能带自定义请求头，所以令牌走查询参数：

```
GET /api/live/stream?token=<访问令牌>
GET /api/live/snapshot     （REST，可用 X-Taixu-Token 头）
```

分级可见性：

- **本地未配令牌**（自己机器上看自己的生命）：全量推送，包括 `thought`。
- **公网配了令牌、连接不带令牌**：只推 `presence` / `vitals` / `act`——你能看到生命「在哪个域忙活」的剪影，但**看不到它的话语和内心**（`thought` 被过滤）。
- **带正确令牌**：全量。

这条规则让「公开围观」与「主人私密视角」共存：路人看剪影，主人看全部。

---

## 4. 最小对接（任意框架）

```ts
const base = 'http://localhost:3000';
const token = ''; // 公网时填

// 首屏
const snap = await fetch(`${base}/api/live/snapshot`).then(r => r.json());
render(snap.presence, snap.vitals);

// 实时
const url = new URL(`${base}/api/live/stream`);
if (token) url.searchParams.set('token', token);
const es = new EventSource(url);
es.addEventListener('presence', e => onPresence(JSON.parse(e.data)));
es.addEventListener('vitals',   e => onVitals(JSON.parse(e.data)));
es.addEventListener('thought',  e => onThought(JSON.parse(e.data)));
es.addEventListener('act',      e => onAct(JSON.parse(e.data)));
```

本仓库的 [`src/sdk.ts`](../src/sdk.ts) 就是这段的类型化封装，外加 `/api/skills`（技能货架）便捷方法。

---

## 5. 还能拿什么

Life SDK 之外，runtime 还有既有 REST 端点可补充呈现（非 SSE，按需轮询）：

- `GET /api/skills` —— 生命已上架/已装的技能（小屋的「货架」用它）
- `GET /api/state` `/api/goals` `/api/episodes` `/api/reflections` `/api/interests` —— 内核观察面板的明细数据

它们是内核自带面板的接口，字段较原始；做对外 UI 优先用 `/api/live/*`（更稳定、更抽象、有版本）。

---

## 6. 做你自己的 UI

把活动域映射成你想要的任何呈现。本仓库 [`src/rooms.ts`](../src/rooms.ts) 就是「小屋」选择的映射（domain→房间），**可整文件删掉换成你的**：

```ts
// 时间线 UI：把 presence 流当事件轴
life.connect({ presence: p => timeline.push({ t: p.since, label: p.domain }) });

// 仪表盘 UI：只关心 vitals
life.connect({ vitals: v => gauges.update(v) });

// 桌宠 UI：domain→表情，thought→气泡
life.connect({
  presence: p => pet.setMood(MOOD[p.domain]),
  thought:  t => pet.say(t.text),
});
```

SDK 不变，呈现千变万化。这正是设计目的。

---

## 7. 版本与兼容

事件契约带 `version`（当前 `1.0`）。破坏性变更升主版本号；新增字段不升主版本。生产 UI 建议启动时打一次 `/api/live/schema` 校验主版本匹配，不匹配则提示升级。
