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
  rooms.ts              consumer-side custom dimension: domain→room mapping (proof of neutrality; drop or swap it)
  config.ts             runtime address / token (read from the URL)
  scenes/HouseScene.ts  Phaser scene: renders SDK events into the pixel house
  main.ts               Phaser bootstrap
docs/
  INTEGRATION.md        deep integration docs (event contract / auth / custom-UI guide)
```

Building your own UI? **Copying `src/sdk.ts` is enough** — everything else is implementation detail of this one "house" presentation.

---

## Nicer visuals (optional)

The repo ships **procedural drawing** (isometric 2.5D house, zero third-party copyright, runs out of the box). Want hand-drawn pixel art like Star Office / LimeZu? There's a built-in **sprite slot + procedural fallback**: drop assets into `public/assets/` and it auto-upgrades without breaking. See **[docs/ASSETS.md](docs/ASSETS.md)** (recommended free asset packs + licensing notes + naming conventions).

> Most asset packs forbid "standalone redistribution", so the repo bundles none and `.gitignore`s assets — downloading them locally for your own use is fine, but public redistribution requires CC0.

## Tech stack

- [Phaser 4](https://phaser.io) (4.1+, the new WebGL renderer)
- TypeScript + Vite
- Procedural pixel drawing (isometric 2.5D); the repo is self-contained with zero third-party copyright; polished assets are opt-in

## License

Official example, open alongside the Taixu life ecosystem.
