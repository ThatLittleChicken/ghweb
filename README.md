# gentyo.ng — personal site

![Screenshot](/public/Screenshot.png)

Personal site of Gent Yong: [gentyo.ng](https://gentyo.ng).

Six pages — **Home · Education · Experience · Projects · Awards · Interests**
## Stack

- Next.js 12 (pages router), React 17, TypeScript — static export (`next export`)
- three.js 0.184 — `<office-scene>` web component in `lib/office-scene.js`, client-side only
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

## Design reference

Redesign implemented from handoff in
[`design_handoff_gentyo_site/`](design_handoff_gentyo_site/) (README + prototype HTML + scene source), kept in the repo for reference.
