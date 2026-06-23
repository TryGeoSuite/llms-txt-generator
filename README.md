<p align="center"><img src="./assets/logo.svg" alt="GeoSuite Open" width="72"></p>

# llms-txt-generator

> A small Node CLI that turns a `sitemap.xml` into an `llms.txt` file — the
> proposed standard for guiding LLMs to the most useful content on a website.
>
> Created and invented by **[Matteo Perino](https://github.com/matte97p)** ([LinkedIn](https://www.linkedin.com/in/matteo-perino-27642016b/)). Built and maintained by [GeoSuite(Matteo Perino)](https://trygeosuite.it).

[![CI](https://github.com/TryGeoSuite/llms-txt-generator/actions/workflows/ci.yml/badge.svg)](https://github.com/TryGeoSuite/llms-txt-generator/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@geosuite/llms-txt-generator.svg)](https://www.npmjs.com/package/@geosuite/llms-txt-generator)
[![npm downloads](https://img.shields.io/npm/dm/@geosuite/llms-txt-generator.svg)](https://www.npmjs.com/package/@geosuite/llms-txt-generator)
[![GitHub stars](https://img.shields.io/github/stars/TryGeoSuite/llms-txt-generator?style=flat&logo=github)](https://github.com/TryGeoSuite/llms-txt-generator/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## What is `llms.txt`?

`llms.txt` is a proposed standard, introduced at [llmstxt.org](https://llmstxt.org/),
for sites to publish a curated, LLM-friendly index of their most important
content. Think of it as a `robots.txt` or `sitemap.xml`, but tuned for the way
language models read the web: a markdown file with a clear H1 site name, an
optional blockquote summary, and `## Section`-delimited lists of links with
short descriptions.

The format is intentionally minimal so it can be parsed both by language
models and by classical tooling (regex, simple parsers). The full spec lives
at [llmstxt.org](https://llmstxt.org/).

## Why GeoSuite cares

GeoSuite helps brands measure and improve how AI engines — ChatGPT,
Perplexity, Gemini, Google AI Overviews — describe and recommend them. A
well-structured `llms.txt` is one of the cheapest, most defensible signals a
site can ship today: it tells answer engines exactly which pages are
canonical, which sections matter, and what each one is about, without forcing
them to re-derive that structure from your full sitemap. We open-sourced this
generator so any team can produce a clean `llms.txt` from a sitemap they
already maintain.

## Install

Requires **Node.js 20 or later** (uses the native `fetch` API).

```bash
# Run without installing
npx @geosuite/llms-txt-generator https://example.com/sitemap.xml

# Or install globally
npm install -g @geosuite/llms-txt-generator
geosuite-llms-txt --help

# Or as a project dev dependency
npm install --save-dev @geosuite/llms-txt-generator
```

## Usage

The simplest invocation reads a sitemap and prints the `llms.txt` to stdout:

```bash
geosuite-llms-txt https://example.com/sitemap.xml \
  --name="Example" \
  --summary="Example is a demo site for the llms.txt format."
```

Write the output to a file instead:

```bash
geosuite-llms-txt ./public/sitemap.xml \
  --name="Example" \
  --out=./public/llms.txt
```

Enrich each entry by fetching the page and extracting `<title>` and
`<meta name="description">`:

```bash
geosuite-llms-txt https://example.com/sitemap.xml \
  --name="Example" \
  --enrich \
  --concurrency=10 \
  --max-entries=500 \
  --out=llms.txt
```

Sitemap-index files are flattened one level automatically — pass them like a
flat sitemap and the tool will fetch the child sitemaps for you.

## CLI flags

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `<sitemap>` | _required_ | First positional argument. URL (`https://...`) or local path to a `sitemap.xml`. Both `<urlset>` and `<sitemapindex>` formats are accepted. |
| `--name=<text>` | `Website` | Site name rendered as the H1 of the output. |
| `--summary=<text>` | _none_ | Short summary rendered as a blockquote under the H1. |
| `--out=<path>` | stdout | Write the rendered file to this path instead of stdout. |
| `--enrich` | off | Fetch each URL once to extract `<title>` and meta description. Best-effort: failures and non-HTML responses are silently skipped. |
| `--concurrency=<n>` | `5` | Parallel HTTP requests when `--enrich` is set. Clamped to `[1, 64]`. |
| `--max-entries=<n>` | unlimited | Cap on the number of URLs processed. Useful for huge sitemaps or quick iteration. |
| `--help`, `-h` | — | Print usage and exit. |

When `--enrich` is on, requests use `User-Agent: geosuite-llms-txt-generator/0.1.0`
and a 10-second timeout per URL.

## Output format

The generator emits the structure described at
[llmstxt.org](https://llmstxt.org/): an H1, an optional blockquote, then one
`## Section` per top-level path prefix, with `- [Title](url): description`
list items.

Example:

```text
# Example

> A short, human-friendly summary of what the site is and who it's for.

## Main

- [Home](https://example.com/): Welcome page and high-level overview.
- [About](https://example.com/about): Who we are and what we do.

## Blog

- [Intro to llms.txt](https://example.com/blog/intro-to-llms-txt): Why the format exists and how to author one.
- [Why GEO matters](https://example.com/blog/why-geo-matters): A primer on Generative Engine Optimization.

## Docs

- [Getting started](https://example.com/docs/getting-started): Install, configure, and run your first build.
- [API reference](https://example.com/docs/api-reference): Endpoints, parameters, and response shapes.
```

A longer real-world example lives at [`examples/sample-output.txt`](examples/sample-output.txt).

### Grouping rules

URLs are grouped by their first path segment:

- `https://site.com/` → section `Main`
- `https://site.com/blog/anything` → section `Blog`
- `https://site.com/case-studies/x` → section `Case Studies` (kebab-case is title-cased)

Within a section, entries appear in sitemap order. The `Main` section is
always rendered first; remaining sections are sorted alphabetically.

## Programmatic API

The package also exports its building blocks for custom pipelines:

```js
import {
  loadSitemap,
  parseSitemap,
  enrichEntry,
  groupByPrefix,
  renderLlmsTxt,
} from '@geosuite/llms-txt-generator';

const { entries } = await loadSitemap('https://example.com/sitemap.xml');
await Promise.all(entries.map((e) => enrichEntry(e)));
const groups = groupByPrefix(entries);
const txt = renderLlmsTxt(groups, { name: 'Example', summary: 'A demo site.' });
```

## Out of scope

- **`robots.txt` honoring** — this tool is run by the site owner against their
  own sitemap, not as a third-party crawler. If you point it at a domain you
  don't own, please respect that domain's terms.
- **JavaScript rendering** — enrichment uses a single HTTP fetch and regex
  extraction. If your titles and descriptions are only set client-side, run
  the tool against a pre-rendered build.
- **Embeddings, summaries, or LLM calls** — the generator is deterministic and
  does not call any model. Authoring the `--summary` text is up to you.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues and PRs welcome — please open
an issue first for non-trivial changes so we can discuss scope.

## AI mode (opt-in, 0.2+)

Without any env keys, the tool's enrichment uses regex on `<title>` and
`<meta name="description">`. With an LLM key configured, the tool can
rewrite each description as a tight one-liner suitable for citation:

```bash
export OPENAI_API_KEY=sk-…           # or ANTHROPIC_API_KEY=sk-ant-…
geosuite-llms-txt https://example.com/sitemap.xml --ai
```

`--ai` implies `--enrich`. We send only the URL + extracted title +
meta description to the provider — never the page body. A typical run
on 200 URLs stays under a couple of cents on small models
(`gpt-5-mini` / `claude-haiku-4-5`).

Privacy: enabling `--ai` sends content to the corresponding API. Don't
turn it on against URLs you wouldn't paste into their UI.

## Related: GeoSuite open-source tools

`llms-txt-generator` is part of a small family of zero-dependency CLIs we maintain to make Generative Engine Optimization (GEO) measurable from the terminal:

- [`@geosuite/ai-crawler-bots`](https://github.com/TryGeoSuite/ai-crawler-bots) — curated AI bot user-agent list with a CLI that tells you whether GPTBot, ClaudeBot, PerplexityBot and friends can read your site and where the block came from.
- [`@geosuite/schema-templates`](https://github.com/TryGeoSuite/schema-templates) — copy-paste-ready schema.org JSON-LD templates with a local validator. Use it to ship `Organization`, `Product`, `FAQPage`, `BreadcrumbList`, etc. without hand-rolling structured data.
- [`@geosuite/sitemap-builder`](https://github.com/TryGeoSuite/sitemap-builder) — crawl a site and emit a valid `sitemap.xml`, for sites that ship without one.

The same checks are also surfaced as a hosted product at [trygeosuite.it](https://trygeosuite.it) for teams who want history, alerts, and CTAs wired into their content pipeline.

## Creator

**Created and invented by [Matteo Perino](https://github.com/matte97p)** — [LinkedIn](https://www.linkedin.com/in/matteo-perino-27642016b/) · [matte97.p@gmail.com](mailto:matte97.p@gmail.com).

Ideated, designed and validated by Matteo Perino. Implementation written with AI assistance, maintained under GeoSuite.

## License

[MIT](LICENSE) © 2026 Matteo Perino and GeoSuite

## Related tools — the GeoSuite GEO toolkit

- [ai-crawler-bots](https://github.com/TryGeoSuite/ai-crawler-bots) — which AI crawlers can read your site (robots.txt audit + CI gate)
- [llms-txt-generator](https://github.com/TryGeoSuite/llms-txt-generator) — sitemap.xml → llms.txt (the llmstxt.org standard)
- [schema-templates](https://github.com/TryGeoSuite/schema-templates) — validated, copy-paste schema.org JSON-LD
- [sitemap-builder](https://github.com/TryGeoSuite/sitemap-builder) — crawl a site, emit a valid sitemap.xml

Also from the same author: [rlsgrid](https://github.com/matte97p/rlsgrid) · [pentest-framework](https://github.com/matte97p/pentest-framework) · [demowright](https://github.com/matte97p/demowright)

---

⭐ If `llms-txt-generator` is useful, [give it a star](https://github.com/TryGeoSuite/llms-txt-generator) — it helps other people find the toolkit.
