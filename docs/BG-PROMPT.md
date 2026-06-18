# 像素小屋背景图 —— 布局规范 & AI 绘图提示词

> 本文件定义了背景图 `office_bg.png` 的房间布局、精确尺寸、小人站位坐标、墙壁位置。
> **AI 生成背景图时必须严格遵守此布局的尺寸比例**，否则小人移动会与背景错位（穿墙/飘空）。
> 接入代码（`rooms.ts` 的坐标）也以此文件为准，保持一致。

---

## 画布与视角

- **尺寸**：1280 × 720 像素（横版 16:9）
- **视角**：正视斜俯（3/4 俯视角，从右上方约 45° 俯瞰），房间方正带轻微纵深
- **风格**：温馨像素风（pixel art），暖色调，类似 Stardew Valley / Habbo 的室内
- **整体**：一整套公寓的俯瞰剖面，四面外墙围合，内部用墙分隔成 6 个功能区

---

## 精确尺寸布局（俯瞰图，北在上）

画布 1280×720。外墙厚 24px 画在画布最外圈。内部分成 **三列**：

```
   外墙内沿：x = 24 ~ 1256（内宽 1232）,  y = 24 ~ 696（内高 672）

   列划分（竖内墙位置）：
     左列  x: 24  ~ 408   宽 384   (书房/社交区)
     中列  x: 432 ~ 848   宽 416   (工作室/客厅)
     右列  x: 872 ~ 1256  宽 384   (卧室/游戏区)
   ※ 列之间留 24px 给内墙

   行划分（横内墙位置）：
     上行  y: 24  ~ 336   高 312   (书房/工作室/卧室床头区)
     下行  y: 360 ~ 696   高 336   (社交区/客厅/游戏区)
   ※ 行之间留 24px 给内墙，但【客厅↔游戏区无墙】连通
```

### 6 个房间的精确边界（x, y, w, h = 左上角 + 宽高）

```
┌─────────────────────────────────────────────────────────────┐ y=0
│▓ 外墙 24px ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│
│▓ ┌───────────┬─────────────┬─────────────┐ ▓          │
│▓ │  书房      │   工作室     │   卧室       │ ▓          │ y=24
│▓ │  study    │  workshop   │  private    │ ▓          │
│▓ │ 384×312   │  416×312    │  384×672    │ ▓          │ ← 卧室通高
│▓ │           │             │  (整列高)    │ ▓          │
│▓ │ 📖(216,   │  🔧(640,    │             │ ▓          │
│▓ │  180)     │   180)      │  🛏(1064,   │ ▓          │
│▓ │           │             │   360)      │ ▓          │
│▓ ├─ 门 ──────┼── 门 ───────┤             │ ▓          │ y=336 横墙
│▓ │           │             │             │ ▓          │
│▓ │  社交区    │  客厅(最大)  │  游戏区      │ ▓          │ y=360
│▓ │  social   │  lounge     │  arcade     │ ▓          │
│▓ │ 384×336   │  416×336    │  384×336    │ ▓          │
│▓ │           │             │  (与客厅     │ ▓          │
│▓ │ 🍽(216,   │  🛋(640,    │   无墙连通)  │ ▓          │
│▓ │  528)     │   528)      │  🎮(1064,   │ ▓          │
│▓ │           │             │   528)      │ ▓          │
│▓ └─── 门 ────┴── 🚪入户门──┴─────────────┘ ▓          │ y=696
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ y=720
   24        408 432        848 872       1256
```

| 房间 | 左上角(x,y) | 宽×高 | 面积 | 小人站位 (x,y) |
|---|---|---|---|---|
| **书房** study | (24, 24) | 384 × 312 | 中 | **(216, 180)** |
| **工作室** workshop | (432, 24) | 416 × 312 | 中 | **(640, 180)** |
| **卧室** private | (872, 24) | 384 × 672 | 大(通高) | **(1064, 360)** |
| **社交区** social | (24, 360) | 384 × 336 | 中 | **(216, 528)** |
| **客厅** lounge | (432, 360) | 416 × 336 | 中(最大视觉中心) | **(640, 528)** |
| **游戏区** arcade | (872, 360) | 384 × 336 | 中 | **(1064, 528)** |

**关键**：卧室占整个右列通高（比其他房间高一倍），视觉上最深、最私密。客厅在正中央，入户门正对它。

---

## 墙壁与门洞（决定小人通行）

```
外墙（24px 厚，画布最外圈）：
  北墙 y:0-24（最里，最高）、南墙 y:696-720（最前，入户门在此）
  西墙 x:0-24、东墙 x:1256-1280

入户门：南墙中部 x:600-680 留门洞（正对客厅）

内墙（24px 厚）：
  竖墙 x:408-432（隔左列/中列）：书房↔工作室段、社交区↔客厅段，各留一个门洞
  竖墙 x:848-872（隔中列/右列）：工作室↔卧室段留门洞
       客厅↔游戏区段：【无墙！】开放式连通（这是唯一不画墙的隔断）
  横墙 y:336-360（隔上行/下行）：书房↔社交区留门洞、工作室↔客厅留门洞
       卧室内部无横墙（通高）、游戏区上方卧室区有横墙
```

**门洞处不画墙**，留通行缺口。客厅↔游戏区完全不画墙、地板连成一片。

---

## 每个房间该画什么（精确家具描述）

> 小人站位坐标处必须是【空地】，家具贴墙摆放，不要挡住站位。

**书房 (24,24) 384×312**：
- 北墙下：大书架（占满北墙，彩色书脊）
- 西墙下：书桌 + 椅子 + 台灯
- 角落：地球仪、落地灯
- 站位 (216,180) 留空

**工作室 (432,24) 416×312**：
- 北墙下：工具墙（挂扳手、电烙铁、钳子，洞洞板感）
- 西墙下：操作仪器（3D打印机、示波器感的机器，带屏幕和指示灯）
- 东侧：工作台 + 零件收纳箱（红黄蓝料盒）
- 站位 (640,180) 留空

**卧室 (872,24) 384×672**（通高，最深处）：
- 上半部：双人床（床头靠北墙）
- 下半部：大衣柜（靠东墙）、床头柜、梳妆台
- 窗帘（东墙窗户）、暖色台灯
- 站位 (1064,360) 留空（床前过道）

**社交区 (24,360) 384×336**：
- 中央：木质长餐桌 + 4 把椅子
- 西墙：餐边柜、酒柜
- 北墙（横墙上沿）：挂画
- 站位 (216,528) 留空

**客厅 (432,360) 416×336**（视觉中心，最大）：
- 南侧（靠入户门方向）：L 型布艺沙发
- 中央：木质茶几 + 大花纹地毯（占客厅中央大面积）
- 北墙下：电视柜 + 电视
- 角落：大型绿植、落地灯
- 站位 (640,528) 留空（茶几旁）
- **东侧无墙**，与游戏区地板连通

**游戏区 (872,360) 384×336**：
- 北墙下：2 台街机柜（屏幕发紫/蓝光）
- 东墙：游戏海报墙
- 中央：懒人豆袋沙发
- 站位 (1064,528) 留空

---

## AI 绘图提示词

### 中文版

```
像素风格温馨公寓室内俯瞰全景图，1280×720像素，3/4斜俯视角（从右上方约45度俯瞰整套公寓剖面）。Stardew Valley风格暖色像素艺术，32像素网格质感，柔和暖光。

【精确布局——必须严格遵循尺寸比例】画布被24像素厚的外墙围合，内部用24像素厚内墙分成6个房间，三列两行结构：

左上【书房】(占画面左上1/6)：靠北墙满排大书架(彩色书脊)、西墙下书桌配台灯和椅子、角落地球仪和落地灯。
中上【工作室】(占画面中上1/6)：北墙下工具墙(洞洞板挂扳手电烙铁钳子)、西墙下操作仪器(3D打印机示波器感带屏幕指示灯)、东侧工作台和红黄蓝零件收纳箱。
右上【卧室】(占整个右侧通高，是最深最私密空间，高度是其他房间两倍)：上半部双人床床头靠北墙、下半部大衣柜靠东墙、床头柜梳妆台、东墙窗帘和窗户、暖色台灯。
左下【社交区/餐厅】(占画面左下1/6)：中央木质长餐桌配4把椅子、西墙餐边柜和酒柜、墙上挂画。
中下【客厅】(画面正中心最大区域)：南侧L型布艺沙发、中央木质茶几和大型花纹地毯、北墙下电视柜电视、角落大型绿植和落地灯。入户门在南墙正中正对客厅。
右下【游戏区】(占画面右下1/6)：北墙下2台街机柜(屏幕发紫蓝光)、东墙游戏海报、中央懒人豆袋沙发。【重要】客厅和游戏区之间【没有墙】，是开放式连通空间，地板连成一片。

【墙壁规则】四面外墙完整围合。内墙分隔房间并开门洞(缺口)连通相邻房间。入户大门在南墙正中正对客厅。客厅与游戏区之间绝对不画墙。

【要求】每个房间中央留出一小块空地(不被家具占满)供角色站立。整体俯瞰能同时看到全部6个房间布局。暖色调，木质地板有纹理，墙面竖向纹理，窗户透柔光。无人物无文字。
```

### 英文版（Midjourney / DALL-E / SD）

```
Pixel art cozy apartment interior overhead view, 1280x720, 3/4 isometric top-down view from upper-right at 45 degrees showing the whole apartment cross-section. Warm Stardew Valley style pixel art, 32px grid, soft warm lighting.

[STRICT LAYOUT — follow proportions exactly] Canvas enclosed by 24px-thick outer walls, interior divided by 24px-thick walls into 6 rooms in a 3-column 2-row structure:

TOP-LEFT [STUDY] (1/6 top-left): full-wall bookshelf with colorful book spines along north wall, wooden desk with lamp and chair along west wall, globe and floor lamp in corner.
TOP-CENTER [WORKSHOP] (1/6 top-center): pegboard tool wall hanging wrenches soldering iron pliers on north wall, operating machines (3D printer oscilloscope with screens and LED indicators) along west wall, workbench and red/yellow/blue parts boxes on east side.
RIGHT-FULL [BEDROOM] (entire right column, FULL HEIGHT — deepest most private space, twice as tall as other rooms): double bed with headboard against north wall in upper half, large wardrobe against east wall in lower half, nightstand vanity table, curtains and window on east wall, warm lamp.
BOTTOM-LEFT [SOCIAL/DINING] (1/6 bottom-left): wooden dining table with 4 chairs in center, sideboard and wine cabinet along west wall, paintings on wall.
BOTTOM-CENTER [LIVING ROOM] (center, largest focal area): L-shaped fabric sofa on south side, wooden coffee table and large patterned rug in center, TV cabinet and TV on north wall, large potted plant and floor lamp in corners. Entrance door in middle of south wall facing living room.
BOTTOM-RIGHT [ARCADE] (1/6 bottom-right): 2 arcade cabinets with glowing purple/blue screens along north wall, game posters on east wall, beanbag chair in center. [CRITICAL] NO wall between living room and arcade — open connected space, floors merge into one.

[WALLS] Four complete outer walls enclose everything. Interior walls separate rooms with doorways (gaps) connecting adjacent rooms. Entrance door in middle of south wall facing living room. ABSOLUTELY no wall between living room and arcade.

[REQUIREMENTS] Leave a small clear floor space in each room center (not covered by furniture) for character to stand. Overall overhead view showing all 6 rooms simultaneously. Warm palette, textured wooden floors, vertical wall texture, windows with soft glow. No people no text.
```

### Midjourney 参数
```
--ar 16:9 --niji 6 --style raw --s 250
```

---

## 生成后检查清单

- [ ] 三列两行结构清晰，6 个房间都在
- [ ] 卧室占整个右侧且通高（比其他房间明显高一倍）
- [ ] 客厅在正中央，入户门在南墙正中正对客厅
- [ ] 客厅和游戏区之间**没有墙**（开放连通，这点最容易出错，重点检查）
- [ ] 每个房间中央有一小块空地（对应小人站位坐标）
- [ ] 俯瞰视角，能同时看到全部 6 个房间
- [ ] 没有画人物

**最关键的硬要求**：①房间相对位置 ②卧室通高 ③客厅↔游戏区无墙 ④入户门正对客厅。家具细节略有出入不影响接入。

---

## 接入约定（你生成图后我按这个接）

图片放到 `public/assets/office_bg.png`（webp/jpg 也行，告诉我路径）。

我会：
1. `this.add.image(640, 360, 'office_bg')` 把图铺满 1280×720 画布
2. `rooms.ts` 坐标改成上表的小人站位（(216,180) 等）
3. 所有文字改成 DOM 元素（永远清晰）
4. 小人在背景图固定坐标间移动（去掉投影数学）
5. 删掉 cabinet 渲染引擎
