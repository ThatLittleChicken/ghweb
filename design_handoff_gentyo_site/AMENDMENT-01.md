# Amendment 01 — responsive layout, mobile nav, scene tweaks

Supplements `README.md`. Where this file and the README disagree, this file wins. The bundled `Gentyo v2.dc.html` and `office-scene.js` are refreshed to match.

## 1. Breakpoints (new)

Three tiers. All values are `max-width` media queries on the viewport.

| Tier | Range | What changes |
|---|---|---|
| Desktop | > 1020px | As documented in README. |
| Compact | ≤ 1020px | Nav links shrink to 14px with `padding: 8px 9px` (underline offset 9px); "Resume.pdf" label hidden — pill shows only "↓". |
| Mobile | ≤ 860px | Hamburger menu replaces inline nav; layout changes below. |

## 2. Header on mobile (≤ 860px)

- Grid becomes `auto 1fr auto`, **gap 0**, padding `16px 20px` (20px matches the content column's side padding so logo and buttons line up with the hero text).
- Inline nav hidden. Right group: `↓` resume pill · theme toggle · **hamburger** (new): 38px circle, same styling as the theme toggle, 18px stroke-2 icon — three lines closed, × when open.
- **Dropdown panel** (opens under the header): `position:absolute; left:20px; right:20px; top: calc(100% - 4px)`; column of links, `gap 4px`, `padding 8px`; bg `--bg`, 1px `--line` border, radius 18px, shadow `0 24px 48px -24px rgba(0,0,0,.35)`; enters with `rise .35s cubic-bezier(.2,.8,.2,1)`. Links: `padding 12px 14px`, radius 12px, Geist 500 16px, no underline. Active page: `background: var(--card); color: var(--acc)`. Selecting a link navigates and closes the menu. State: `menu: boolean`.

## 3. Home on mobile

- Hero: no forced min-height; hero column 100% wide; name `font-size: clamp(40px, 9vw, 84px)` (floor lowered from 44px, vw factor raised so it scales on phones).
- Office scene: `height: min(78vh, 620px)`, **opacity .5**, and the fade ellipse is overridden to be centred and long: `--fade-x: 50%`, `--fade-w: 140%`, `--fade-h: 38%`, `--fade-y: 38%`. Implementation: the mask generator now emits `var(--fade-x, <computed>)`, `var(--fade-w, W%)`, `var(--fade-h, H%)`, `var(--fade-y, Y%)` so a media query can override any of them without touching the JS.
- Door cards: `margin-top: 40px`, `gap 10px`; each card collapses to a compact row — `min-height 0`, `padding 16px 18px`, radius 16px, `display:grid; grid-template-columns: 1fr auto; align-items:center`. Meta line (index/count) spans both columns at 11px; label 20px; sub text spans both columns at 14px.
- Footer links: `gap 10px 20px`, `margin-top 48px`.

## 4. Sub-pages on mobile

- Every two-column row (`minmax(…) minmax(0,1fr)` grid) becomes a single column: `grid-template-columns: 1fr; gap: 6px 0; padding: 22px 0` — meta/date sits above the content.
- Awards: year label no longer sticky. Each award row is `flex-wrap: wrap`; name `flex: 1 1 200px`, prize `flex: 1 0 auto; margin-left: auto; text-align: right` so when the prize wraps to its own line it right-aligns.
- Projects grid: `repeat(auto-fit, minmax(min(100%, 300px), 1fr))` so cards never overflow narrow screens.

## 5. Desktop refinements since the first handoff

- Home cards now sit `8px` under the hero block (was 64px) — the hero itself carries the vertical space (`min-height: min(72vh, 720px)`).
- Header nav is a true 3-column grid `1fr auto 1fr` so the nav is centred regardless of side-group widths; `html { overflow-y: scroll }` keeps a persistent thin scrollbar so widths don't jump between pages.
- Theme toggle uses inline SVG sun/moon (Lucide-style, 16px, stroke 2) instead of text glyphs.
- Card fill tokens: light `--card: rgba(255,255,255,.55)`, dark `--card: rgba(20,22,26,.7)`.
- Hero fade has **separate light/dark parameter sets** (`fadeWidth/…` and `fadeWidthDark/…`); the X centre is anchored to the 1180px content column.
- Letter "dodge" replaced hover colour on the name (see README §Home).

## 6. Office scene (office-scene.js) changes

- **Dark mode lighting** rebalanced for soft falloff: exposure .95; hemisphere .06; fill .04; moonlight sun .15; desk lamp is the key light (intensity 3.5, distance 2.6, decay 2.2) in **warm amber `#ffb15c`** (bulb emissive matches); pendant intensity 10, distance 4.5, decay 2.4; a blue monitor spill light (`#6f8fd6`, intensity 1.6, distance 2.2) sits in front of the screens. Light mode: exposure 1.15, hemisphere .8, fill .45, sun 2.8; walls `#d9d2c6` / `#cdc5b8`.
- Monitors: 40"-class landscape (0.9 × 0.5 m panel) + 32"-class portrait (0.4 × 0.71 m) on short stands with a rear arm bracket; screens carry a scrolling code texture with a human-like scroll controller (scroll a few lines with ease-out, pause 0.6–4s, occasional back-scroll, jump to top at end) and a fixed chrome overlay (title bar, status bar). Laptop has its own screen.
- Desk objects re-seated on the true desk surface; thin layers use `polygonOffset`; renderer uses `logarithmicDepthBuffer`, near/far 0.5/40.
- Added: shelf props (vinyl, hourglass, camera, trophy, succulents, dice, figurine, box), tall side unit (frame, plant, jar, bookend, basket), wall clock rebuilt facing the room, headphones lying flat on the desk, floor lamp in the back corner, door, switch/outlet, floorboards + ceiling, window mullions casting a cross shadow.
- Outside the window: meadow + lake, two rows of layered conifers, a deciduous tree, small village with spire, drifting clouds, flying birds, sun halo and haze; all recolour for night.
- Camera: focus `(0.5, 1.0, -1.5)`, orbit base angle 0.62 rad ± 0.14, radius 6.6, height 2.1, view offset 34% to the right; 25 fps cap; pauses when tab hidden.

## 7. Files refreshed in this bundle
- `Gentyo v2.dc.html` — includes the responsive CSS block (`.gy-*` classes in the helmet style) and menu state.
- `office-scene.js` — all scene changes above.
