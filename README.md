# HindiDrama.net – GitHub, Cloudflare Pages & Google SEO Ready

Enterprise SSR/Edge streaming web application for Korean, Chinese, Japanese, and Indian dramas in Hindi dubbed HD, built with React, Vite, Tailwind CSS, `hls.js`, TMDB live sync, and Cloudflare Pages Functions.

## Deploy to Cloudflare Pages (via GitHub)

1. Push this repository to GitHub (`main` branch).
2. Open **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**.
3. Select your GitHub repository and configure:
   - **Framework preset**: `None` (or `Vite`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Optional Environment Variables in Cloudflare Pages (**Settings → Environment variables**):
   - `NODE_VERSION` = `22`
   - `TMDB_API_KEY` = `174d0214bf933dd59b3d5ec68a0c967f`
   - `SITE_URL` = `https://your-custom-domain.com` (auto-detects `*.pages.dev` if omitted)

Cloudflare Pages automatically compiles and deploys `/functions/*` alongside `dist/`:
- `functions/[[path]].ts` — Edge SSR rendering + dynamic TMDB meta tags, canonical URLs, OpenGraph, and JSON-LD (`TVSeries`, `TVEpisode`, `AggregateRating`, `BreadcrumbList`, `FAQPage`, `Person`).
- `functions/sitemap.xml.ts` & `functions/robots.txt.ts` — Dynamic Google XML Sitemap & robots directives.
- `functions/api/server-ping.ts` — Edge provider health check for multi-server player failover.
- `public/_headers` & `public/_redirects` — Immutable asset caching and clean route fallbacks.

## Automated GitHub TMDB Sync

The included workflow (`.github/workflows/auto-sync-and-ci.yml`) runs daily at `04:00 UTC` (or manually via **Actions → Run workflow**):
- Fetches latest trending & popular K-Dramas, C-Dramas, and J-Dramas from TMDB.
- Updates `src/data/dramas.json`, `public/sitemap.xml`, and `public/robots.txt`.
- Commits and pushes updates back to GitHub, automatically triggering a fresh Cloudflare Pages production deployment.

## Deploy to GitHub Pages (Static — Zero Blank Screen)

The workflow (`.github/workflows/auto-sync-and-ci.yml`) includes an automated `deploy-github-pages` job:
1. Enable **Settings → Pages → Source: GitHub Actions** in your GitHub repository.
2. Push to `main` (or trigger `build:gh`): Vite automatically configures `VITE_BASE_PATH` (`/your-repo-name/` or `/` for user sites), generates `dist/404.html` and `dist/.nojekyll`, and serves all client routes cleanly with zero 404 asset blank screens.

## Local Development & Node SSR

```bash
npm install
npm run dev       # Express + Vite SSR/ISR dev server on http://localhost:3000
npm run lint      # TypeScript type-check
npm run build     # Static SEO + Client bundle (dist/) + Node SSR bundle (dist-server/)
npm run build:gh  # GitHub Pages static bundle with SPA 404 fallback + .nojekyll
npm run start     # Production Node SSR server on port 3000
```
