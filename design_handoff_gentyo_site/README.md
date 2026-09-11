# Handoff: gentyo.ng — personal site redesign

## Overview
Redesign of Gent Yong's personal site (currently https://gentyo.ng, repo `ThatLittleChicken/ghweb`, Next.js). Six views — Home, Experience, Education, Projects, Awards, Writing — plus a handwritten "hello there" loader, light/dark theme, a three.js home-office hero scene, and a downloadable resume PDF link. Target audience: recruiters and grad-school admissions; tone is friendly but restrained.

## About the design files
Files in this bundle are **design references built in HTML** (`Gentyo v2.dc.html` + `office-scene.js`). They show intended look and behaviour; they are not production code. Recreate them in the existing Next.js codebase using its patterns (pages/components, CSS modules or Tailwind). `support.js` is the prototype runtime only — ignore it. The `{{ }}` holes, `<sc-for>`, `<sc-if>`, `style-hover` attributes in the HTML are prototype templating: read them as React props/`.map()`/conditionals/`:hover` rules.

`office-scene.js` is a self-contained ES module (`<office-scene>` web component using three.js 0.184). It can be ported almost as-is: mount it in a client-only component (`dynamic(..., { ssr: false })`), or convert it to react-three-fiber. It is the one piece that is fine to lift directly.

## Fidelity
**High-fidelity.** Colours, type, spacing, motion timings and copy are final. Match pixel-for-pixel; content is verbatim from the resume.

## Global

### Page shell
- `html { overflow-y: scroll }` (persistent scrollbar so centring doesn't jump); thin 8px scrollbar, thumb `rgba(128,128,128,.35)`.
- Body background `--bg`, text `--fg`; transitions `background .5s, color .5s` on theme change.
- Content container: `max-width: 1180px; margin: 0 auto; padding: clamp(24px,5vh,64px) clamp(20px,5vw,64px) 80px; box-sizing: border-box`. Header uses the same container with `padding: 22px clamp(20px,5vw,64px)`.
- Background decoration (behind everything, `pointer-events:none`):
  - Two blurred blobs: top-left 60vw circle `--blob1`, `blur(90px)`, opacity .75, drifts 26s; bottom-right 55vw circle `--blob2`, `blur(100px)`, opacity .7, drifts 32s (keyframes `drift1/drift2` in the HTML).
  - Dot grid: `radial-gradient(var(--line) 1px, transparent 1px)` 28px cells, opacity .55, masked to a centre ellipse.

### Loader (first paint)
- Fixed full-screen overlay, `--bg` background, z-index 50. Centred SVG "hello there" handwriting (`viewBox 0 0 560 170`, width `min(260px, 60vw)`, stroke `currentColor` 3px, round caps). Two paths with `stroke-dasharray` 1282 and 1311; keyframes `loop1`/`loop2` (1.9s, linear, infinite): word 1 draws 0–34%, word 2 draws 34–66%, hold to ~80%, both erase by 100%.
- Dismiss rule: when `document.readyState === 'complete'` **and** the office canvas exists (or 3D disabled), with a **minimum 1.2s** and **maximum 6s** on screen. Fade out `opacity .45s ease`, then unmount ~0.5s later. Typing starts 0.7s after fade begins.
- The Home `<main>` is not mounted until the loader is gone, so its entrance animations run after.

### Header
- Grid `1fr auto 1fr`, `align-items:center; gap:20px` — nav is always dead-centre regardless of side widths.
- Left: logo `gentyo.ng` — Geist 700 18px, `letter-spacing:-.02em`, preceded by a 10px `--acc` dot that blinks (`blink` 2.4s steps(1)). Click → Home.
- Centre nav: Home · Experience · Education · Projects · Awards · Writing. Geist 500 15px, `padding: 8px 12px`, radius 999px. Active/hover underline is a 2px `--acc` line drawn with `background-image: linear-gradient(--acc,--acc)` sized `calc(100% - 24px) 2px` at `12px calc(100% - 6px)`; inactive size `0 2px`; transition `background-size .35s cubic-bezier(.2,.8,.2,1)`.
- Right: "Resume.pdf ↓" pill — bg `--fg`, text `--bg`, Geist 600 14px, `padding: 9px 16px`, radius 999px; hover `translateY(-2px)` + shadow `0 8px 20px -8px var(--fg)`. Then a 38px round theme toggle — 1px `--line` border, `--card` bg, inline SVG sun (light) / moon (dark) 16px, stroke 2; hover border `--fg`.

### Page transition
Each view's `<main>` animates in with `pageIn .6s cubic-bezier(.2,.8,.2,1)`: from `opacity 0; translateY(18px) scale(.995); blur(4px)`. Navigation scrolls to top.

## Screens

### 1. Home
**Hero row** — `min-height: min(72vh, 720px)`, flex, vertically centred. Text column `width: min(100%, 560px)`, left-aligned.
- **Name** `h1` "Gent Yong": Newsreader 500, `clamp(44px, 5.5vw, 84px)`, line-height 1, `letter-spacing: -.03em`; entrance `rise .9s .1s`. Each character is its own `inline-block` span. **Cursor dodge**: on `mousemove` over the h1, every letter within 90px of the pointer is translated away along the pointer→letter vector by `34 * k²` px (k = 1 − dist/90) and rotated `6k` deg; `transition: transform .45s cubic-bezier(.2,.8,.2,1)`; all reset on `mouseleave`. No colour change on hover.
- **Intro paragraph**: Geist 400 `clamp(16px,1.6vw,18px)`, line-height 1.55, `--mute`, `max-width 520px`, `margin-top 26px`. Copy (verbatim, bold segment in `--fg` 600):
  > CS senior at Brigham Young University who builds things end to end and researches how networks shape inequality. Finishing **Dec 2026**, looking for SWE roles and grad school.
  **Typewriter**: render the full text invisibly (`visibility:hidden`) to reserve layout, overlay the typed prefix absolutely. Per-character delay `7–21ms`; after a space +2ms (15% chance +30ms); after `,` or `.` +70–130ms; 2% random +90ms hesitation. Cursor: 2px × 1em `--acc` bar, `blink 1s steps(1)`, hidden when done. Replays when returning to Home.
- **3D office scene** (`<office-scene dark="0|1">`): absolutely positioned behind the hero, `top:0; left:0; right:0; height: min(100vh, 900px)`, fades in `sceneIn 2.4s .3s ease-out` to opacity 1. Only mounted on Home. Masked with two composited (intersect) gradients:
  1. Vertical: `linear-gradient(180deg, black 0%, black 70%, transparent 100%)`.
  2. Radial clear zone behind the text — `radial-gradient(ellipse W% H% at X Y%, …)` where **X is anchored to the content column**: `calc(max(0px, (100% - 1180px)/2) + fadeX%)`. Separate parameter sets for light/dark. Defaults (light): width 75, height 50, X 18, Y 57, centre feather 62, centre drop 58, edge feather 57, edge drop 46. Dark set starts identical. The stop list generated from these is in `renderVals().sceneMask` in the HTML — port that function.
  Scene camera: 3/4 view from front-right, slow orbit ±0.14 rad over ~60s, parallax on mouse (x ×0.22 rad, y ×0.45 m), view offset shifted 34% so the desk sits right of centre. Renders at ≤25 fps, pixel ratio 1, max 1100px wide; pauses when tab hidden.
- **Door cards** (3, below hero, `margin-top 8px`, grid `repeat(auto-fit, minmax(240px,1fr))`, gap 16px, entrance `rise .9s .4s`): `padding 26px`, radius 22px, 1px `--line` border, bg `--card`, `min-height 190px`, flex column gap 18px. Top row JetBrains Mono 12px `--mute` (index left, count right). Label Geist 600 26px `letter-spacing -.02em` pushed to bottom (`margin-top:auto`). Sub Geist 15px `--mute` lh 1.4. Hover: `translateY(-5px)`, shadow `0 30px 50px -30px rgba(0,0,0,.35)`, border `--acc`; transition `.4s cubic-bezier(.2,.8,.2,1)`.
  - 01 · 5 roles · **Work** · "Research at BYU, an AWS event pipeline at Partner.Co, and more." → Experience
  - 02 · 4 projects · **Built** · "From a serverless ChatGPT wrapper to a DQN that rewires networks." → Projects
  - 03 · 22 awards · **Won** · "ASEAN science fairs to the Malaysian Computing Challenge, 2016–2021." → Awards
- **Footer links** (`margin-top 72px`, centred, wrap, gap `8px 28px`, JetBrains Mono 13px `--mute`, entrance `rise .9s .55s`): `yonggh@byu.edu` (mailto) · github (https://github.com/thatlittlechicken) · linkedin (https://www.linkedin.com/in/gentyong/) · instagram (https://instagram.com/genthoong) · spotify (https://open.spotify.com/user/22kf3sv5ir57t7v7jf3qm3upy).

### 2–6. Sub-pages (shared pattern)
- Title `h1`: Newsreader 500, `clamp(40px,6vw,72px)`, lh 1, `letter-spacing -.03em`, trailing period in `--acc`. Titles: **Work.** / **Studied.** / **Built.** / **Won.** / **Wrote.**
- Lede `p`: Geist 16px lh 1.55 `--mute`, `max-width 520px`, `margin-bottom 56px`.
- Row layout: grid `minmax(120px,180px) minmax(0,1fr)`, gap `12px 32px`, `padding 30px 0`, `border-top 1px --line`; rows stagger in with `rise .7s` at `0.15s + i×0.08s`.
- Left column meta: JetBrains Mono 13px `--mute`.

**Experience** — lede "Research and web work at BYU, plus a summer in industry. Most recent first." Row title Geist 600 `clamp(20px,2.2vw,24px)` + org Geist 16px `--mute` inline; bullets `ul` Geist 16px lh 1.5 `--mute`, gap 8px.
1. Feb 2025 – present · Undergraduate Researcher · BYU · HCMI Lab & MTRIE Lab — "Investigated poverty mitigation through RL by optimally rewiring networks using DQN with PyTorch, achieving results outperforming baseline." / "Built a consolidated multimodal language repository to reform CRUD operations for NLP training and linguistic research."
2. Apr – Aug 2026 · Software Engineer Intern · Partner.Co · Lehi, UT — "End-to-end event pipeline spanning event definition, database emission, API Gateway, EventBridge, SQS and Lambda, with DynamoDB idempotency handling and DLQs." / "Contributed to a Quarkus tracing extension that injects trace context into events, enabling annotation-driven end-to-end CloudWatch tracing."
3. May 2024 – Dec 2025 · Web Developer · BYU — "Maintained and improved the department site; created 100+ web pages." / "Built a Next.js + Pixi.js game with MySQL user data, hosted on the department IIS server for marketing events, reaching 2,000+ players."
4. Jan 2024 – Feb 2025 · Makerspace Lab Technician · BYU — "Backend queue automator integrating Google and Box APIs with Node.js webhooks on EC2, removing 90% of manual entries." / "Researched emerging technologies and tools for the university makerspace."

**Education** — lede "Brigham Young University, August 2022 to December 2026."
- Row "2022 – 2026": "Bachelor of Science in Computer Science" (Geist 600 clamp 20–24px) / "Brigham Young University · Provo, UT · Math minor" (16px mute). Below, two stat cards (grid `minmax(200px,1fr)`, gap 14px, `margin-top 26px`; `padding 18px 20px`, radius 16px, `--card` bg, 1px `--line`): label JetBrains Mono 11px `--mute`; **GPA** → "3.98" Newsreader 500 30px; **Honors** → "Dean's List · Academic Scholarship · Google Endowed Mentorship Scholarship" 15px.
- Row "Coursework": chips (Geist 14px, `padding 7px 12px`, radius 999, 1px `--line`, `--card`; hover border+text `--acc`): Reinforcement Learning, Algorithm Design & Analysis, Software Design, Advanced Software Construction, Systems Programming, Web Programming, Machine Learning, Computational Theory, Multivariable Calculus.
- Row "Skills": two lines, label in `--mute` then value — Languages: "Python, TypeScript, JavaScript, Java, C, C++, SQL, HTML, CSS, Unix · English, Chinese, Malay"; Technologies: "Agentic Tooling, Node.js, React, Next.js, Express, AWS, MySQL, MongoDB, Supabase, REST API, Git, CI/CD, Sklearn, PyTorch, NumPy, Pandas, NetworkX".

**Projects** — lede "Projects and research, with the stack on each." Grid `repeat(auto-fit, minmax(300px,1fr))`, gap 18px. Card: `padding 28px`, radius 24px, `--card`, 1px `--line`, `min-height 260px`, flex column gap 16px; tag chips JetBrains Mono 11px `padding 4px 8px` radius 999 1px `--line` `--mute`; title Geist 600 22px at bottom; desc 15px `--mute`; CTA Geist 600 14px `--acc` + " →". Same hover as door cards. Links are placeholders (`#`).
1. ChatGPT Wrapper — TypeScript, Next.js, OpenAI API, AWS, Tailwind — "Tailored multimodal agents for real-world needs with file and web search. Serverless via CloudFront + Lambda, Cognito auth, SES email, Aurora and S3 storage." — CTA "Case study"
2. Network rewiring with DQN — PyTorch, NetworkX, RL — "Research code behind the IEEE SMC submission: optimally rewiring exchange networks to mitigate poverty, outperforming baseline." — "Read the paper"
3. Department arcade game — Next.js, Pixi.js, MySQL — "Web game for department marketing events, hosted on IIS, played by 2,000+ people." — "Play"
4. Makerspace queue automator — Node.js, Google API, Box API, EC2 — "Webhook listener that turns patron submissions into a live queue, removing 90% of manual entries." — "How it works"

**Awards** — lede "Awards from school and mostly external competitions during high school, through hard work and determination." Row grid `minmax(90px,160px) minmax(0,1fr)`, `padding 26px 0`. Year: Newsreader 500 `clamp(28px,3.5vw,40px)`, `position: sticky; top: 20px`. Items: flex space-between, `padding 10px 0`, `border-bottom 1px dashed --line`, Geist 16px; prize right-aligned JetBrains Mono 12px `--mute`; hover text `--acc`.
- 2021: Malaysian Computing Challenge — Gold Award · INTI e-workshop Programming Maze Challenge — 1st Prize · INTI e-workshop EDA Circuit Design — 3rd Prize
- 2020: International Astronomy and Astrophysics Competition — Finalist, Bronze · CEC Young Engineers 100 Day Makerthon — Silver, Best Advertisement · English Online Interclass Debate 2020 — 2nd Prize
- 2019: The First International Youth UAV Science Camp and Competition — 1st Prize · IET Faraday Challenge Malaysia — 2nd Prize · IET Faraday Challenge Penang — 2nd Prize · UBTECH Robotics Competition Smart Factory — 2nd Prize · State Award for Excellence in Extra Curricular Activities — Gold Award · STEAM Science Fair — Merit Prize · School's Club Performance Award — Gold Award · School's Club Performance Report — Best Slides Design
- 2017: MISCC Robotic Workshop and Competition 2017 — Excellence Award · Choral Speaking Competition — Excellence Award · 13th Annual Interclass Performing Arts Competition — Silver Award
- 2016: The Second ASEAN Student Science Project Competition (ASPC 2016) — 1st Prize · ACCCIM STI Competition — 1st Prize · Tan Kah Kee Young Inventors 2016 — Overall Champion · 12th Annual Interclass Performing Arts Competition — Silver Award · Annual Hill Climbing Competition — 20th Place

**Writing** — lede "Papers and talks so far. Blog posts land here too." Rows are links (hover text `--acc`), grid `minmax(90px,160px) minmax(0,1fr)`, `padding 28px 0`. Meta JetBrains Mono 13px; title Geist 600 `clamp(18px,2vw,22px)` lh 1.3; sub 15px `--mute`.
1. "2026 · IEEE SMC (submitted)" — "Network structure and the persistence of economic inequality: Evidence from agent-based exchange models" — "Shields, L., Yong, G., Moreno, E., Dawadi, N., Nye, J., & Goodrich, M. A."
2. "2026 · BYU SRC" — "Effects of Gratitude: Reciprocity in Networks and the Dynamics of Inequality" — "Yong, G. Presentation at the BYU Student Research Conference."
3. Final row (not a link, bottom border too): meta "Blog" — "First post coming soon. Posts will list here with date, title and a one-line summary, same layout as above." (Replace with real posts when available.)

## Interactions & behaviour summary
- Routing: six routes (`/`, `/experience`, `/education`, `/projects`, `/awards`, `/writing`); scroll to top on navigate; each mounts with `pageIn`.
- Theme: toggle persists (use `localStorage` + `data-theme` on `<html>`); the office scene receives `dark="1|0"` and re-lights itself (night sky, lamp/pendant/monitor glow become the sources; ambient near zero).
- Loader, typewriter, letter-dodge, nav underline, card hover as specified above.
- `prefers-reduced-motion`: the scene stops orbiting (mouse parallax remains); consider also skipping the typewriter and letter-dodge.
- Responsive: everything is fluid (`clamp`, `auto-fit` grids, wrapping nav). Below ~600px the nav wraps under the logo; hero text column is 100%.

## State
- `page` (route), `theme` ('light'|'dark'), `loading` / `fading` (loader), `typed` (int), `typingDone`, `dodge` (per-letter offsets). All content is static — no data fetching.

## Design tokens
Light: `--bg #f5f5f3`, `--fg #161719`, `--mute #6b6f76`, `--line #dcdedf`, `--acc oklch(0.48 0.1 250)` (≈ #3d5a8a), `--card rgba(255,255,255,.55)`, `--blob1 oklch(0.92 0.02 250)`, `--blob2 oklch(0.93 0.015 90)`.
Dark: `--bg #101113`, `--fg #ececea`, `--mute #8e939b`, `--line #26292d`, `--acc oklch(0.75 0.09 250)` (≈ #94aee0), `--card rgba(20,22,26,.7)`, `--blob1 oklch(0.28 0.03 250)`, `--blob2 oklch(0.26 0.02 90)`.
Type: **Geist** 400/500/600/700 (body/UI), **Newsreader** 400/500 optical-size axis (display headings), **JetBrains Mono** 400/500 (meta). Google Fonts URL is in the HTML `<link>`.
Radii: 999 pills · 22 door cards · 24 project cards · 16 stat cards · 8px scrollbar thumb 4.
Motion: standard ease `cubic-bezier(.2,.8,.2,1)`; `rise` (26px up, .7–.9s), `pageIn` (.6s), `blink` (steps), `sceneIn` (2.4s).
Spacing: container padding `clamp(20px,5vw,64px)`; section rows 26–30px vertical; card padding 26–28px.

## Assets
- Handwritten "hello there" SVG paths — lifted from the current repo's `components/Hello.jsx` (already in the HTML).
- `public/monochrome.svg`, `public/monochrome-black.svg` — existing site logos from the repo (not used in the new design; kept for reference).
- Sun/moon icons — inline SVG (Lucide-style, stroke 2).
- 3D scene — fully procedural in `office-scene.js` (no textures/models to load; three.js from CDN pinned at 0.184.0 — install as a dependency instead).
- Resume PDF — link the real file; the prototype uses `#`.

## Files
- `Gentyo v2.dc.html` — all six views, header, loader, tokens, keyframes, and the logic class (`class Component`) with content arrays, typewriter, dodge, and `sceneMask` generator.
- `office-scene.js` — the `<office-scene>` three.js web component (room, furniture, outdoor view, lighting, theme switch, scrolling code on monitors, human-like scroll controller).
- `support.js` — prototype runtime, not needed.
- `public/*.svg` — legacy logos.
