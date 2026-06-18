# Taixu · Life House (taixu-house)

> **English** · [中文](README-cn.md)

> The **official example UI** for Taixu digital life — and at the same time a **reference implementation** and **hands-on tutorial** for integrating with a life runtime.

A pixel-art 2D house seen **from the life's point of view** — you watch it walk between rooms, bubble its thoughts, play games, do research, craft skills, like watching an electronic creature live its own days.

But more importantly: **it shows any developer how to integrate with a Taixu runtime and build their own UI for a life.** The house is just one way to present it; the SDK never dictates how you draw.

```
┌─────────────┬─────────────┐
│  Social     │  Study      │   social    ← post / comment / follow
│  (social)   │ (knowledge) │   knowledge ← search / read / learn
├─────────────┼─────────────┤
│  Games      │  Workshop   │   play      ← Undercover / duels
│  (play)     │ (create)    │   create    ← skills / scripts / commissions + 🗄 shelf
├─────────────┴─────────────┤
│  Rest · Data (reflect)    │   reflect   ← reflection / idle + vitals bar
└───────────────────────────┘
      ◍ the life walks between rooms, thoughts bubbling overhead
```

---

## What it is / isn't

| Is | Isn't |
|---|---|
| A demo consumer of the runtime Life SDK | Part of the life core (the core ships no UI) |
| Reference code for "how to integrate" | The one official interface (build a totally different UI if you like) |
| A runnable integration tutorial | A requirement to use Phaser / to draw rooms |

**Core idea**: Taixu enforces strict `Life Core ⟂ UI` decoupling. The runtime only emits **life-semantic signals** through the SDK (what kind of thing it's doing, its state, its thoughts); **how to present them always belongs to the UI**. The house renders "activity domains" as rooms — you're free to render them as a timeline, a dashboard, a 3D avatar, or a plain text stream.

---

## Quick start

Prerequisite: a life runtime running locally (listens on `http://localhost:3000` by default).

```bash
npm install
npm run dev
# open http://localhost:5173
```

Connect to a different life / with a token (for networked deployments):

```
http://localhost:5173/?runtime=http://localhost:3001&token=YOUR_ACCESS_TOKEN
```

Build the static bundle:

```bash
npm run build      # outputs to dist/
npm run preview
```

---

## Integration in 30 seconds

The whole integration is three runtime endpoints + one SSE stream. The SDK client lives in [`src/sdk.ts`](src/sdk.ts) (pure TS, zero framework deps — copy it straight into any project):

```ts
import { LifeClient } from './sdk';

const life = new LifeClient('http://localhost:3000' /*, token */);

// 1) first-paint snapshot: render the current state immediately
const snap = await life.snapshot();   // { presence, vitals, thoughts }

// 2) live event stream: the life starts moving
life.connect({
  presence: (p) => moveAvatarTo(p.domain),  // activity domain changed → your presentation
  vitals:   (v) => updateBars(v),            // state changed
  thought:  (t) => showBubble(t.text),       // a line / reflection / intent / memory
  act:      (a) => flash(a.domain, a.ok),    // every tool call
});
```

That's it. The rest — what it looks like — is entirely up to you.

Full fields, the activity-domain vocabulary, and the auth model are in **[docs/INTEGRATION.md](docs/INTEGRATION.md)**, or just ask the runtime: `GET /api/live/schema` (a self-describing contract).

---

## Layout

```
src/
  sdk.ts              ★ Life SDK client reference implementation (framework-agnostic, reusable)
  rooms.ts              default room layout (fallback); semantic domain→room mapping
  layout.ts             waypoint-graph config: load (localStorage > PNG > default) + pathfinding
  config.ts             runtime address / token (read from the URL)
  scenes/HouseScene.ts  Phaser scene: renders SDK events into the pixel house
  scenes/hud.ts         DOM HUD (always-crisp text overlaid on the canvas)
  editor/               the layout editor (separate page)
  editor/pngMeta.ts     read PNG tEXt chunk (embedded layout config)
docs/
  INTEGRATION.md        deep integration docs (event contract / auth / custom-UI guide)
scripts/
  embed-png.mjs         embed layout.json into a PNG's tEXt chunk (lossless)
```

Building your own UI? **Copying `src/sdk.ts` is enough** — everything else is implementation detail of this one "house" presentation.

---

## Visuals: background image + waypoint graph

The house is rendered as a **static background image** (`public/assets/office_bg.png`) plus a tiny **waypoint graph** that tells the code where the life stands and how it walks between rooms. No procedural drawing, no isometric math — the art is whatever you put in the image, the code only moves a sprite along the graph.

This means **anyone can re-skin the house without touching code**:

1. Generate a pixel-art room image with AI (or draw one) — 1280×720, top-down 3/4 view.
2. Drop it at `public/assets/office_bg.png`.
3. Open **`/editor.html`** — the built-in layout editor. Draw the waypoint graph on top of your image:
   - 6 room nodes (tag each with its domain: study / workshop / lounge / social / arcade / private)
   - connect adjacent rooms with lines
   - click a line to insert a waypoint (the life walks through it — use this to route around furniture)
   - drag nodes to align with the actual room positions in your image
4. **Save** (to the browser) and refresh — the life now walks your layout.
5. **Export** `layout.json`, then embed it into the PNG so the image is self-contained (see below).

### Embedding the layout into the PNG (self-contained distribution)

The layout can be embedded into the PNG itself as a standard `tEXt` chunk (key `taixu-layout`). A PNG that carries its own layout needs **no extra files** — anyone can drop it in and it just works.

```bash
# after exporting layout.json from the editor:
node scripts/embed-png.mjs public/assets/office_bg.png layout.json
# → produces office_bg.with-layout.png (lossless: original pixels untouched, +~2KB metadata)
```

**Runtime load priority**: `localStorage` (your in-editor save) > PNG embedded `taixu-layout` > code default (`src/rooms.ts`). So a distributed PNG with embedded layout works out of the box, and any user can still override it locally via the editor.

> Why a script and not the browser? Browsers can read PNG bytes and parse `tEXt`, but can't losslessly rewrite a multi-megabyte PNG download. The Node script does a true lossless insert (just splices a chunk after IHDR). See [`scripts/embed-png.mjs`](scripts/embed-png.mjs).

### Full re-skin → distribute workflow

```
AI-generate office_bg.png  →  /editor.html draw waypoints  →  export layout.json
   ↓
node scripts/embed-png.mjs office_bg.png layout.json   # lossless embed
   ↓
share the single office_bg.with-layout.png  →  others drop it in public/assets/ and done
```

See **[docs/ASSETS.md](docs/ASSETS.md)** for the background-image spec, room-layout conventions, and the AI prompt template (`docs/BG-PROMPT.md`).

## Tech stack

- [Phaser 4](https://phaser.io) (4.1+, the new WebGL renderer)
- TypeScript + Vite (multi-page: `index.html` house + `editor.html` layout editor)
- Static background image + waypoint-graph pathfinding (no procedural drawing)
- DOM HUD (always-crisp text, never blurred by canvas scaling)

## License

Official example, open alongside the Taixu life ecosystem.
