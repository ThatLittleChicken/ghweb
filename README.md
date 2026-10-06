# gentyo.ng — personal site

![Screenshot](/public/Screenshot.png)

Personal site of Gent Yong: [gentyo.ng](https://gentyo.ng).

Six pages — **Home · Education · Experience · Projects · Awards · Interests**
## Stack

- Next.js 12 (pages router), React 17, TypeScript — static export (`next export`)
- three.js 0.184 — `<city-scene>` web component in `lib/city-scene.js`, client-side only (see below)
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

`lib/city-scene.js` renders a procedural downtown in Utah Valley, seen from a ~240 m vantage on the west side with the Wasatch Front behind it. Nothing is modelled or downloaded; everything is generated on load.

- **Terrain**: one fragment pass writes a float heightmap (fault-scarp landform + ridged multifractal + a downhill erosion filter). Two more passes bake normals, soft sun and moon shadows, horizon AO and curvature. Bakes run once, in strips, so they don't stall weaker GPUs.
- **City**: blocks on a 160 m grid with arterials every fifth street and a freeway across the mid-ground. Downtown cores get towers (setback tiers, slabs, paired wings, a few landmarks), then perimeter mid-rise blocks, then houses under tree canopy. All buildings are one instanced box; facades, windows, curtain-wall reflections and night interiors are shaded per pixel, with window detail falling back to suites and floor groups at distance so it doesn't shimmer.
- **Light**: a one-off orthographic depth render of the buildings gives sun shadows across streets and neighbouring towers. Sky, clouds, stars and moon are a dome shader; height fog, aerial perspective and the city's own glow in the haze tie it together.
- **Bustle**: ~20k cars move along the streets and freeway (boxes by day, head- and tail-light streams at night), plus street lamps, red beacons on tall towers, aircraft on approach, and windows that switch on through dusk and occasionally change.
- **Theme**: the `dark` attribute animates one `uNight` uniform over ~2.4s, so switching theme plays dusk (alpenglow on the range, then the city lighting up) or dawn.
- **Budget**: 30fps cap, pauses when hidden or scrolled away, drops render resolution if frames run slow, lighter terrain, fewer buildings and cars, and a smaller shadow map on phones; honours `prefers-reduced-motion` (traffic and clouds hold still).

Composition knobs are the constants at the top of the file: `CAM`/`AIM` (viewpoint), `SUN`/`MOON` (light, and where the moon sits in frame), `CORES` (where the towers cluster and how tall), `FWY_J` (which street line is the freeway).

## Design reference

Redesign implemented from handoff in
[`design_handoff_gentyo_site/`](design_handoff_gentyo_site/) (README + prototype HTML + scene source), kept in the repo for reference.
