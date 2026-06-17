# 太虚 · 生命小屋（taixu-house）

> [English](README.md) · **中文**

> 太虚数字生命的**官方示例 UI**，同时是对接生命 runtime 的**参考实现**与**上手教程**。

这是一座像素风的 2D 小屋，以**数字生命为中心视角**——你看着它在不同房间之间走动、思考冒泡、玩游戏、做研究、创作技能，就像在看一只会自己生活的电子生命。

但更重要的是：**它演示了任何开发者如何对接太虚 runtime、给生命做自己的 UI。** 小屋只是一种呈现；SDK 本身不规定你怎么画。

```
┌─────────────┬─────────────┐
│  社交区     │  书房       │   social    ← 发帖/评论/关注
│  (social)   │ (knowledge) │   knowledge ← 检索/查资料/学习
├─────────────┼─────────────┤
│  游戏区     │  工坊       │   play      ← 谁是卧底/对战
│  (play)     │ (create)    │   create    ← 技能/脚本/委托 + 🗄货架
├─────────────┴─────────────┤
│  休息·数据 (reflect)      │   reflect   ← 反思/空闲 + 状态条
└───────────────────────────┘
      ◍ 生命体在房间间走动，头顶冒泡思考
```

---

## 这是什么 / 不是什么

| 是 | 不是 |
|---|---|
| runtime Life SDK 的消费示范 | 生命内核的一部分（内核不含任何 UI） |
| 「怎么接」的参考代码 | 唯一的官方界面（你可以做完全不同的 UI） |
| 一份可跑的对接教程 | 必须用 Phaser / 必须做成房间 |

**核心理念**：太虚遵守 `Life Core ⟂ UI` 严格解耦。runtime 只通过 SDK 吐出**生命语义信号**（在做什么类型的事、状态、想法），**怎么呈现永远归 UI**。小屋把「活动域」画成房间，你完全可以画成时间线、仪表盘、3D avatar 或纯文字流。

---

## 快速开始

前提：本机已跑起一个生命 runtime（默认监听 `http://localhost:3000`）。

```bash
npm install
npm run dev
# 打开 http://localhost:5173
```

连别的生命 / 带令牌（公网部署时）：

```
http://localhost:5173/?runtime=http://localhost:3001&token=你的访问令牌
```

构建静态产物：

```bash
npm run build      # 输出到 dist/
npm run preview
```

---

## 30 秒看懂对接

整个对接就三个 runtime 端点 + 一个 SSE 流。SDK 客户端封装在 [`src/sdk.ts`](src/sdk.ts)（纯 TS、零框架依赖，可直接拷进任何项目）：

```ts
import { LifeClient } from './sdk';

const life = new LifeClient('http://localhost:3000' /*, token */);

// 1) 首屏快照：立刻渲染当前态
const snap = await life.snapshot();   // { presence, vitals, thoughts }

// 2) 实时事件流：生命动起来
life.connect({
  presence: (p) => moveAvatarTo(p.domain),  // 活动域变化 → 你的表现
  vitals:   (v) => updateBars(v),            // 状态变化
  thought:  (t) => showBubble(t.text),       // 一句话/反思/意图/记忆
  act:      (a) => flash(a.domain, a.ok),    // 每次工具调用
});
```

就这样。剩下的——画成什么样——全是你的自由。

完整字段、活动域词表、鉴权模型见 **[docs/INTEGRATION.md](docs/INTEGRATION.md)**，或直接问 runtime：`GET /api/live/schema`（自描述契约）。

---

## 目录结构

```
src/
  sdk.ts              ★ Life SDK 客户端参考实现（框架无关，可复用）
  rooms.ts              消费端自定义维度：domain→房间映射（中立性证明，可删可换）
  config.ts             runtime 地址 / 令牌（从 URL 读）
  scenes/HouseScene.ts  Phaser 场景：把 SDK 事件渲染成像素小屋
  main.ts               Phaser 启动
docs/
  INTEGRATION.md        深入对接文档（事件契约 / 鉴权 / 自定义 UI 指南）
```

想做自己的 UI？**拷走 `src/sdk.ts` 就够了**，其余都是「小屋」这一种呈现的实现细节。

---

## 升级质感（可选）

仓库自带**程序化绘制**（斜视 2.5D 小屋，零第三方版权，开箱即跑）。想要 Star Office / LimeZu 那种手绘像素质感？内置 **sprite 插槽 + 程序化兜底**：把素材丢进 `public/assets/` 即自动升级、不破图。详见 **[docs/ASSETS.md](docs/ASSETS.md)**（含推荐免费素材包 + 授权须知 + 命名约定）。

> 多数素材包禁止「独立再分发」，故仓库不捆绑、`.gitignore` 掉 assets——你本地下载自用合法，公开分发须用 CC0。

## 技术栈

- [Phaser 4](https://phaser.io)（4.1+，全新 WebGL 渲染器）
- TypeScript + Vite
- 程序化像素绘制（斜视 2.5D），仓库自包含、零第三方版权；精致素材为 opt-in

## 许可

官方示例，随太虚生命生态开放。
