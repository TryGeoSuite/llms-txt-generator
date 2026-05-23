# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.3.2 — 2026-05-23

### Fixed

- Test runner: replaced `node --test test/` with `node --test test/*.js`. The directory form was rejected on Node 22 (`Cannot find module`), breaking CI.

### Changed

- README and `package.json` now credit **Matteo Perino** as creator and inventor (with GitHub + LinkedIn), maintained under GeoSuite. LICENSE copyright reads "Matteo Perino and GeoSuite".

## 0.3.0 — 2026-05-10

### Added

- `--respect-robots` flag: fetches `/robots.txt` before enrichment and drops
  entries whose paths are disallowed for `User-Agent: *`. Only active when
  the sitemap source is an HTTP/HTTPS URL (local file paths are skipped).
  New `filterByRobots(entries, sitemapUrl, opts)` export in `src/index.js`.
  New module `src/robots.js` (zero deps, fetch-based).

## 0.2.3 — 2026-05-10

### Added

- README: npm downloads badge (alongside the existing version + CI
  badges).
- `npm run coverage` script using Node 22's built-in
  `--experimental-test-coverage` (zero new dependencies).

### Changed

- CI workflow now triggers on the `production` branch (matching the
  actual default branch) instead of `main`. Workflow now also runs
  `npm run lint` and a coverage step on the Node 22 matrix entry.

## 0.2.2 — 2026-05-10

### Changed

- Republish; no source changes (resolved npm CDN propagation lag noted
  at 0.2.1).

## 0.2.1 — 2026-05-10

### Added

- `llms-txt-generator` bin alias matching the npm package name so
  `npx @geosuite/llms-txt-generator` works without `--package=`.

## 0.2.0 — 2026-05-10

### Added

- `--include-only=<a,b,c>` and `--exclude-patterns=<a,b,c>` CLI flags.
  Path-prefix filters applied after the sitemap is fetched and before
  the max-entries cap. Excludes win on conflicts. Useful for trimming
  rumorous sitemap-indexes on big sites.
- `assets/logo.svg` — shared GeoSuite Open mark; rendered as the README
  hero. Monochrome on transparent, uses `currentColor`.
- `.github/workflows/publish.yml` — runs lint+tests, verifies that the
  pushed `v*` tag matches `package.json`'s `version`, then publishes
  to npm with provenance.
- `src/ai.js` — optional LLM helper. Auto-detects `OPENAI_API_KEY` or
  `ANTHROPIC_API_KEY` (first one wins). Native `fetch`, no third-party SDK.
- CLI `--ai` flag — implies `--enrich`. After regex enrichment fills
  `title` and `meta description`, the LLM rewrites a tighter one-line
  description per URL using only those fields (never the page body).
  Falls back to the regex description on per-entry failure.
- `npm run lint` script (syntax check across source files).

### Notes on privacy and cost

- AI mode is **opt-in**. Without `--ai`, the CLI behaves exactly as 0.1.0.
- A typical run on 200 URLs stays under a couple of cents on `gpt-5-mini`
  / `claude-haiku-4-5`. We send only `{url, title, meta_description}` per
  page — never the full HTML.

## 0.1.0 — Initial release

- Parse flat `<urlset>` sitemaps and `<sitemapindex>` files.
- Load sitemaps from an HTTPS URL or a local path.
- Optional per-URL enrichment (`<title>` + `<meta name="description">`) via the
  `--enrich` flag, with a configurable concurrency limit.
- Group URLs by first path segment and render an `llms.txt` document per the
  spec at https://llmstxt.org/ (H1 site name, optional blockquote summary,
  `## Section` per group, `- [Title](url): description` list items).
- CLI binary `geosuite-llms-txt` with stdout or `--out=<path>` output.
- Single runtime dependency: `fast-xml-parser`.
