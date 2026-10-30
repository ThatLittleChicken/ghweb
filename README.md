# gentyo.ng — personal site

![Screenshot](/public/Screenshot.png)

Personal site of Gent Yong: [gentyo.ng](https://gentyo.ng).

Six pages — **Home · Education · Experience · Projects · Awards · Interests**
## Stack

- Next.js 12 (pages router), React 17, TypeScript — static export (`next export`)
- three.js 0.184 — `<office-scene>` web component in `lib/office-scene.js`, client-side only (see below); the painting on its wall comes from `lib/shan-shui.js`
- CSS design system in `styles/globals.css` (tokens, keyframes, responsive breakpoints at 1020px/860px)
- Firebase Hosting (`ghweb-f209d`), analytics optional via `NEXT_PUBLIC_FIREBASE_*` env vars

## Develop

```bash
npm install
npm run dev      # dev server on localhost:3000
npm run build    # production build + static export to out/
```

## Editing content

All copy lives in [`data/content.ts`](data/content.ts) — intro, nav, door cards, jobs, projects, awards, papers, coursework, skills, footer links.

- **Interests photos**: images in `public/photos/` and list in `INTEREST_PHOTOS`; `INTERESTS` chips render below the album when non-empty.
- **Resume**: links to Google Drive in `components/Header.jsx`.

## Deploy

Pushing to `main` builds and deploys to live via GitHub Actions
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)); pull requests get preview channels. Requires the
`FIREBASE_SERVICE_ACCOUNT_GHWEB_F209D` repo secret (provisioned with `firebase init hosting:github`).

## Home background scene

`lib/office-scene.js` renders a home office seen from inside the room: a desk beside a steel-framed window that looks out to the Wasatch Range, an office chair, a bookshelf and a floor lamp. Nothing is modelled or downloaded; geometry, textures, the monitor's screen and the painting on the wall are generated on load. `components/OfficeScene.tsx` mounts it as the `<office-scene>` web component.

- **Camera**: eye level with vertical lines kept straight (a level camera plus lens shift through `setViewOffset`), framed so the desk sits right of the hero text. Slow drift and pointer parallax. Phones get their own framing, aimed at the desk with the window to its right.
- **Light theme**: low afternoon sun through the window, shadow-mapped so the window grid falls across the wall; sky light from the window as a rect area light; an environment probe rendered from inside the room carries the warm bounce off the sunlit floor and wall.
- **Dark theme**: the desk lamp (shadowed spot), the monitor and the window as area lights, a dim floor lamp, moonlight and a cool ambient fill. The `dark` attribute cross-fades the two rigs over ~2.4 s, passing through a short golden-hour light.
- **Painting**: the framed picture is a new [{Shan, Shui}*](https://github.com/LingDong-/shan-shui-inf) landscape by Lingdong Huang (MIT) every time the scene appears, on each page load and each return to the home page. `lib/shan-shui.js` runs his generator in a Web Worker from a random seed (printed on the mat), unrolls the scroll until a mountain can be framed, and paints a portrait window of it onto an `OffscreenCanvas`; the painting fades in when it is ready, usually before the first frame. Browsers without workers or `OffscreenCanvas` get a generated contour print.
- **Detail**: the monitor shows research code that scrolls like someone reading it (its own texture layer, so scrolling costs no redraws) beside a network that rewires itself (a second small layer); steam over the coffee, dust in the sunbeam, a wall clock on the visitor's local time. The books have printed spines (titles, gilt bands, labels, series stripes) and page edges, from one generated atlas, and every book in the room is a single mesh.
- **Post**: GTAO ambient occlusion at half resolution, read from the scene's own depth buffer so the room isn't drawn twice; bloom at night only; SMAA; then AgX tone mapping and the grade (grain, vignette) in a single pass.
- **Budget**: 30 fps cap; pauses when the tab is hidden or the scene is scrolled away; shadow maps render once; static meshes are merged per material (about 60–80 draw calls per frame including post-processing). Render resolution is device pixels up to 1.5× within a budget of about 2 megapixels (0.9 on the light path) and steps down if frames run slow. The frame rate drops to 24 fps while the room is idle (no pointer movement for 3 s, no theme change or painting fade), and rendering holds while the page is scrolling. Shaders compile in parallel before the first frame where the browser supports it; the other theme's environment probe is baked when the page is idle. Phones and machines with 4 or fewer cores get smaller textures and shadow maps, fewer AO samples and no bloom. Honours `prefers-reduced-motion` (camera drift, curtain, dust and code scrolling hold still, and the painting appears without a fade).
- **Navigation**: leaving the home page pauses the scene and keeps it for three minutes instead of tearing it down; coming back hands the same scene to the new `<office-scene>`, so there is no second WebGL context or start-up, and its new painting has been prepared in the meantime.

Composition knobs are the constants at the top of the file: `FRAMINGS` (camera), `SUN` (sun direction), `WIN` and `DESK` (layout); light levels per theme are in `RIG` inside `createApp`.
