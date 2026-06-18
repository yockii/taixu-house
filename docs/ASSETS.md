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

## 进阶：atlas 图集接入（一张大图 + JSON 帧坐标）

单图管线（上面的 `furniture/<id>.png` 槽位）适合「每件裁成独立 PNG」。
但主流像素素材包（LimeZu / Star Office 等）通常是 **atlas**——多件拼在一张大 PNG 里，
外加一份 JSON 描述每件的坐标。本项目也支持直接吃 atlas，省去逐件裁图。

### 放置文件

```
public/assets/atlas/
├── atlas.png      # 大图（多件拼图）
└── atlas.json     # Phaser atlas JSON（frames 列表）
```

放进这两个文件即可，刷新浏览器自动生效。`.gitignore` 已忽略整个 `assets/`，不会被提交。

### 帧命名约定（渲染按名查询）

| 逻辑名 | 用途 | 说明 |
|---|---|---|
| `furniture/<roomId>` | 整房间家具图 | 如 `furniture/study`，居中摆放、自动限高。命中后该房间不再程序化画家具 |
| `character/walk/down/0`、`/1`… | 行走动画帧 | 多帧自动播放（8fps）。如只放单帧 `character/walk/down` 也行（静态） |

查询是**容错匹配**：精确名 → 前缀（`furniture/bookshelf` 命中 `furniture/.../bookshelf`）→ 后缀。所以你不必严格对齐命名，接近即可。

### atlas.json 格式示例（Phaser 标准）

```json
{
  "frames": [
    { "filename": "furniture/study", "frame": { "x": 0,  "y": 0, "w": 96, "h": 80 } },
    { "filename": "furniture/lounge", "frame": { "x": 96, "y": 0, "w": 120, "h": 96 } },
    { "filename": "character/walk/down/0", "frame": { "x": 0, "y": 80, "w": 16, "h": 24 } },
    { "filename": "character/walk/down/1", "frame": { "x": 16, "y": 80, "w": 16, "h": 24 } }
  ]
}
```

> 多数素材包自带 atlas.json（TexturePacker / ShoeBox / LimeZu 原生格式）。
> 若你的素材只有大图没有 JSON，用 [TexturePacker](https://www.codeandweb.com/texturepacker)（有免费版）
> 或 [Free Texture Packer](http://free-tex-packer.com/) 生成 Phaser JSON。

### 优先级

渲染时每个绘制点按这个顺序找图，任一命中即用，全 miss 才程序化：
1. atlas 帧（`furniture/<id>` 等）
2. 单图槽位（`furniture/<id>.png`）
3. 程序化兜底

所以你可以**只替换一部分**：比如只丢一个 `furniture/study` atlas 帧升级书房，其余房间继续程序化，互不影响。

---



## 它如何回退（实现参考）

`src/scenes/HouseScene.ts`：
- `preload()` 容错加载所有槽位（缺图静默）。
- `has(key)` = `this.textures.exists(key)` 判断有没有放图。
- 每处绘制（地板/家具/小人）都是 `if (this.has(...)) 用图 else 程序化`。

所以仓库永远能跑、永远不破图，质感是纯粹的 opt-in 增强。
