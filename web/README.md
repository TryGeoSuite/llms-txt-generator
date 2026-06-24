# llms.txt Generator — hosted tool

A [Cloudflare Worker](https://developers.cloudflare.com/workers/) that puts
[`llms-txt-generator`](../) behind a paste-a-URL web page: give it a site, it
reads the `sitemap.xml` and returns a ready-to-ship [`llms.txt`](https://llmstxt.org/).
Same pipeline as the CLI (`parseSitemap → groupByPrefix → renderLlmsTxt`).

- `GET /` — the page (`page.js`), bilingual **en/it** (auto-detected from `Accept-Language`; `/en` · `/it` force a locale)
- `GET /og.png` · `GET /favicon.svg` — Open Graph share image (1200×630) + favicon
- `GET /api/generate?url=https://example.com` — `{ site, count, truncated, llmstxt }`

Structure-only (no per-page titles/descriptions — that's the CLI's `--enrich`,
which fetches every page). No database, no tracking: it fetches only the
sitemap (and child sitemaps for a sitemap index).

## Run locally

```bash
npm install          # at the repo root — bundles fast-xml-parser
cd web
npx wrangler dev
# open http://localhost:8787
```

## Deploy

```bash
npm install          # repo root
cd web
npx wrangler deploy
```

⚠️ Deploy to your **personal / GeoSuite** Cloudflare account, not the work one
(`wrangler whoami` to check). Publishes to
`https://llmstxt-generator.<your-subdomain>.workers.dev`.

## Auto-deploy (CI)

[`.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml)
redeploys on every push to `main` touching `web/`, `src/`, or `package.json`.
Add two repo secrets (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN` — token scoped **Edit Cloudflare Workers** from the
  account that owns the Worker.
- `CLOUDFLARE_ACCOUNT_ID` — that account's id.

## Notes

- `nodejs_compat` lets the package's `node:*` imports resolve at bundle time —
  none run on this path; the sitemap download uses the platform `fetch()`.
  `fast-xml-parser` is bundled (hence `npm install` before deploy).
- Large sitemaps are capped (first 2000 URLs; first 10 child sitemaps of an
  index) to keep responses fast.
- This directory is **not** part of the npm package, so it never ships to
  registry consumers.
