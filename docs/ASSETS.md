# 升级到精致像素素材（可选 · opt-in）

taixu-house 仓库**只自带程序化绘制**（屋顶/墙/家具/小人都是代码画的），保证：
- **零第三方版权**——仓库可自由开源、商用、再分发。
- **开箱即跑**——`npm install && npm run dev` 立刻能看，无需任何素材。

如果你想要 Star Office / LimeZu 那种**手绘像素质感**，本项目内置了 **sprite 插槽 + 程序化兜底**：把素材图丢进 `public/assets/`，渲染时自动用图、没图就回退程序化，**永不破图**。

---

## ⚠️ 先读：为什么仓库不自带这些图

多数像素素材包（bitglow / LimeZu / Cainos 等）的授权是「**允许你在项目里用，但禁止把文件独立再分发**」。

把这些 PNG 提交进**公开 GitHub 仓库** = 独立再分发 = **违反授权**。

所以：
- 仓库 `.gitignore` 掉了 `public/assets/{character,tiles,furniture}/`——你下载的素材**只留在本地**，不会被提交。
- 想合法**捆绑**进公开仓库，素材必须是 **CC0**（公有领域，无分发限制）。
- 你**自己下载**的素材放本地自用，完全合法——下面教你接。

---

## 资源槽位与命名

放到 `public/assets/` 下，文件名固定（渲染按名加载）：

```
public/assets/
├── character/
│   └── avatar.png            # 生命体小人（单图，origin 底部中心）
├── tiles/
│   └── floor.png             # 地板（平铺）
└── furniture/
    ├── social.png            # 社交区家具
    ├── study.png             # 书房家具
    ├── arcade.png            # 游戏区家具
    ├── workshop.png          # 工坊家具
    ├── lounge.png            # 休息区家具
    └── private.png           # 私密区家具（保险箱等）
```

- 每个 `furniture/<roomId>.png` 是**一张单图**（一件/一组家具），靠房间地面居中摆放、自动限高。
- 没放的槽位自动走程序化兜底——可以只替换一部分。
- 放完**刷新浏览器**即生效（Vite 热更）。

> 注：当前管线吃**单图**。素材包常是「图集（atlas）」——多件拼在一张大图里。你需要先用图像工具（或 TexturePacker / 在线切图）把要用的那件**裁成单图**再丢进槽位。若需要直接吃图集（spritesheet 帧坐标），告诉我，可扩展管线。

---

## 推荐的素材包

| 包 | 风格 | 授权 | 适合槽位 |
|---|---|---|---|
| [bitglow · Pixel Interior](https://bitglow.itch.io/) | 暖室内饰（沙发/书架/桌椅/厨房） | 免费，可商用，**禁再分发** | furniture/* |
| [LimeZu · Modern Interiors](https://limezu.itch.io/moderninteriors) | 精致斜视室内（Star Office 同款风格） | 部分免费/付费，**禁再分发** | furniture/* + character + tiles |
| [Cainos · Pixel Art Top Down](https://cainos.itch.io/pixel-art-top-down-basic) | 户外 RPG（墙体斜视高度 + 角色） | 免费，可商用 | character/avatar + tiles/floor |

下载 → 解压 → 把需要的件裁成单图 → 按上表命名丢进 `public/assets/` → 刷新。

**CC0（可直接捆绑进公开仓库）**：[itch.io CC0 素材](https://itch.io/game-assets/assets-cc0)、[Kenney.nl](https://kenney.nl)（全 CC0）。CC0 的精致室内较少，但若你要做一个「自带美术、可开源分发」的分支，从这里找。

---

## 它如何回退（实现参考）

`src/scenes/HouseScene.ts`：
- `preload()` 容错加载所有槽位（缺图静默）。
- `has(key)` = `this.textures.exists(key)` 判断有没有放图。
- 每处绘制（地板/家具/小人）都是 `if (this.has(...)) 用图 else 程序化`。

所以仓库永远能跑、永远不破图，质感是纯粹的 opt-in 增强。
