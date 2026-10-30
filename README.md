# gentyo.ng — personal site

![Screenshot](/public/Screenshot.png)

Personal site of Gent Yong: [gentyo.ng](https://gentyo.ng).

Six pages — **Home · Education · Experience · Projects · Awards · Interests**
## Stack

- Next.js 12 (pages router), React 17, TypeScript — static export (`next export`)
- three.js 0.184 — `<office-scene>` web component in `lib/office-scene.js`, client-side only (see below)
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

`lib/office-scene.js` renders a home office seen from inside the room: a desk beside a steel-framed window that looks out to the Wasatch Range, an office chair, a bookshelf and a floor lamp. Nothing is modelled or downloaded; geometry, textures and the monitor's screen are generated on load. `components/OfficeScene.tsx` mounts it as the `<office-scene>` web component.

- **Camera**: eye level with vertical lines kept straight (a level camera plus lens shift through `setViewOffset`), framed so the desk sits right of the hero text. Slow drift and pointer parallax. Phones get their own framing.
- **Light theme**: low afternoon sun through the window, shadow-mapped so the window grid falls across the wall; sky light from the window and warm floor bounce as rect area lights; an environment probe rendered from inside the room.
- **Dark theme**: the desk lamp (shadowed spot), the monitor and the window as area lights, a dim floor lamp, moonlight and a cool ambient fill. The `dark` attribute cross-fades the two rigs over ~2.4 s, passing through a short golden-hour light.
- **Detail**: the monitor shows research code that scrolls like someone reading it (its own texture layer, so scrolling costs no redraws) beside a network that rewires itself; steam over the coffee, dust in the sunbeam, a wall clock on the visitor's local time.
- **Post**: GTAO ambient occlusion, bloom, AgX tone mapping, SMAA, grain and vignette.
- **Budget**: 30 fps cap; pauses when the tab is hidden or the scene is scrolled away; shadow maps render once; static meshes are merged per material (about 105–130 draw calls per frame including post-processing). Render resolution steps down if frames run slow. Phones and machines with 4 or fewer cores get half-size textures and shadow maps, half-resolution AO and no bloom. Honours `prefers-reduced-motion` (camera drift, curtain, dust and code scrolling hold still).

Composition knobs are the constants at the top of the file: `FRAMINGS` (camera), `SUN` (sun direction), `WIN` and `DESK` (layout); light levels per theme are in `RIG` inside `createApp`.
