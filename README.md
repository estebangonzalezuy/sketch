# Motion Studios Index

A drifting, numbered index of 779 motion design studios worldwide, Nº 001 to Nº 779.
Sourced, not generated. By The Motion Social Club (tMSC), part of Human + Tool.

Static site: Vite, React and TypeScript. There is no server, database or runtime fetch. Deploys to Vercel.

## Run it

```bash
npm install
npm run dev        # regenerates the data, then starts Vite
npm run build      # data → typecheck → bundle → per-page meta HTML in dist/
npm test           # Vitest data checks
npm run lint
```

## Updating the data

1. Replace `data/studios.csv`. Keep the columns `name,city,country,website,specialties,source`.
   - `city`, `country`, `specialties` and `source` can hold several values separated by `; `.
   - `source` is `notion`, `som` or `notion; som`.
   - Leave unknown fields empty. The site shows them as “Unknown” and never fills them in.
2. Optional: add `data/studios_extended.csv` (`name,description,instagram,notion_url,som_number`).
   Only `instagram` is used, matched by name. `description` is ignored on purpose.
3. Run `npm run build` (or `npm run data` on its own). `scripts/build-data.ts` writes
   `src/data/studios.json` and `src/data/facets.json`. Both are generated and git-ignored.
4. Run `npm test`. It checks that the row count matches the CSV, that slugs are unique, that empty
   fields stay empty, and that no value is missing from its source row. If the total is no longer 779,
   update the `779` in `tests/data.test.ts`.
5. If the total changed, regenerate the social images with `npm run og`. This needs a Playwright
   install with Chromium available globally. Commit the PNGs in `public/og/`.

What the build script does to the data:

- Nº follows a case-insensitive alphabetical sort of names, so numbers shift when studios are added.
  URLs use slugs, and duplicate names get `-2` and `-3` suffixes.
- Stray HTML in names (for example `<b>72andSunny</b>`) is stripped.
- Websites without a scheme get `https://`. Anything that can't be parsed is kept as it is.
- On `/cities`, a city sits under a country only when the source pairs them unambiguously. That means
  a single country, or equal numbers of cities and countries. Other cities go under “Country unconfirmed”.

## Deploying (Vercel)

Import the repo in Vercel. `vercel.json` sets the build and output, clean URLs, long cache headers for
`/assets` and an SPA fallback rewrite.

The post-build script writes `about.html`, `cities.html` and one `s/<slug>.html` per studio, each with
its own title, description and Open Graph tags, so shared links preview correctly. For absolute
`og:image` and canonical URLs, plus `sitemap.xml`, set `SITE_URL` (for example
`https://studios.example.com`). On Vercel, `VERCEL_PROJECT_PRODUCTION_URL` is used automatically.

## How it works

- `src/components/PixelHeadline.tsx` draws text at font size ÷ cell on an offscreen canvas,
  thresholds it, and paints each lit pixel as a square cell. Cells are about 6px, and smaller on phones
  so letters stay legible. The real text stays in the DOM (`sr-only`). It redraws on resize, font load,
  theme change and DPR change.
- `src/lib/drift.ts` runs the auto-scroll at 24 px/s with `requestAnimationFrame`. It pauses on hover
  or focus inside the list and controls, on wheel, touch, key or pointer input (resuming after 3.5 s),
  and when the tab is hidden. It is off by default under `prefers-reduced-motion`.
- `src/lib/query.ts` holds search (accent and case insensitive, every word must match name, city,
  country or domain), filters (AND across facets, OR within one), live facet counts and seeded
  shuffle. All of this state lives in the URL.
- `src/lib/router.tsx` is a tiny history router with scroll restoration. The list renders in chunks
  of 30 as you approach the end.
- Theme: an inline script in `index.html` sets `data-theme` before first paint from `localStorage`
  or `prefers-color-scheme`, so there is no flash.

Keyboard: `/` focuses search, `Esc` clears it, `↑`/`↓` move between rows, `Enter` opens one.

## Credits

- **notion**: “Motion Design Studios”, a list compiled by SK Robert ([skrowbear.com](https://skrowbear.com)).
- **som**: “500 Studios You Need to Know”, School of Motion
  ([schoolofmotion.com/landing-page/500-studios](https://www.schoolofmotion.com/landing-page/500-studios)).
- Geist Sans by Vercel, SIL Open Font License (`public/fonts/LICENSE.txt`).

The data may be outdated. Studio names and websites belong to their owners.
