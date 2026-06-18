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
  rooms.ts              默认房间布局（兜底）；domain→房间语义映射
  layout.ts             路点图配置：加载（localStorage > PNG > 默认）+ 寻路
  config.ts             runtime 地址 / 令牌（从 URL 读）
  scenes/HouseScene.ts  Phaser 场景：把 SDK 事件渲染成像素小屋
  scenes/hud.ts         DOM HUD（叠在画布上、永远清晰的文字）
  editor/               布局编辑器（独立页面）
  editor/pngMeta.ts     读取 PNG tEXt chunk（内嵌的布局配置）
docs/
  INTEGRATION.md        深入对接文档（事件契约 / 鉴权 / 自定义 UI 指南）
scripts/
  embed-png.mjs         把 layout.json 嵌入 PNG 的 tEXt chunk（无损）
```

想做自己的 UI？**拷走 `src/sdk.ts` 就够了**，其余都是「小屋」这一种呈现的实现细节。

---

## 视觉：背景图 + 路点图

小屋由一张**静态背景图**（`public/assets/office_bg.png`）+ 一个微型**路点图**渲染。代码不画任何东西，只负责让小人沿路点图走动——图是什么样，小屋就是什么样。

这意味着**任何人都能换肤，不用改代码**：

1. 用 AI 生成一张像素房间图（或自己画）——1280×720，俯瞰 3/4 视角。
2. 放到 `public/assets/office_bg.png`。
3. 打开 **`/editor.html`**——内置的布局编辑器。在图上画路点图：
   - 6 个房间节点（每个标注 domain：书房/工作室/客厅/社交区/游戏区/卧室）
   - 把相邻的房间用线连起来
   - 点一条线可插入中转点（小人会经过它——用来绕开家具）
   - 拖动节点对齐图里的实际房间位置
4. **保存**（存浏览器）后刷新——小人就按你的布局走了。
5. **导出** `layout.json`，然后嵌入 PNG 让图自带配置（见下）。

### 把布局嵌入 PNG（自包含分发）

布局可以嵌入 PNG 自身的标准 `tEXt` chunk（键名 `taixu-layout`）。一张自带布局的 PNG **不需要任何额外文件**——任何人放进去就能跑。

```bash
# 编辑器导出 layout.json 后：
node scripts/embed-png.mjs public/assets/office_bg.png layout.json
# → 生成 office_bg.with-layout.png（无损：原始像素不变，仅 +约 2KB 元数据）
```

**运行时加载优先级**：`localStorage`（你在编辑器存的）> PNG 内嵌的 `taixu-layout` > 代码默认（`src/rooms.ts`）。所以分发的 PNG 自带配置开箱即用，任何用户仍可用编辑器本地覆盖。

> 为什么用脚本而不是浏览器？浏览器能读 PNG 字节、能解析 `tEXt`，但无法无损重写一个几 MB 的 PNG 下载。Node 脚本做的是真正的无损插入（只是在 IHDR 后拼一个 chunk）。见 [`scripts/embed-png.mjs`](scripts/embed-png.mjs)。

### 完整换肤 → 分发工作流

```
AI 生成 office_bg.png  →  /editor.html 画路点图  →  导出 layout.json
   ↓
node scripts/embed-png.mjs office_bg.png layout.json   # 无损嵌入
   ↓
分享这一张 office_bg.with-layout.png  →  别人放进 public/assets/ 即可
```

背景图规格、房间布局约定、AI 绘图提示词见 **[docs/ASSETS.md](docs/ASSETS.md)** 和 **[docs/BG-PROMPT.md](docs/BG-PROMPT.md)**。

## 技术栈

- [Phaser 4](https://phaser.io)（4.1+，全新 WebGL 渲染器）
- TypeScript + Vite（多页面：`index.html` 小屋 + `editor.html` 布局编辑器）
- 静态背景图 + 路点图寻路（无程序化绘制）
- DOM HUD（永远清晰的文字，不受画布缩放影响）

## 许可

官方示例，随太虚生命生态开放。
