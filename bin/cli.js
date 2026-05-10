#!/usr/bin/env node
// CLI for @geosuite/llms-txt-generator.
//
// Usage:
//   geosuite-llms-txt <sitemap> [--name=...] [--summary=...] [--out=...] [--enrich] \
//                     [--concurrency=5] [--max-entries=N] [--help]

import { writeFile } from 'node:fs/promises';
import { loadSitemap, enrichEntry, groupByPrefix, renderLlmsTxt } from '../src/index.js';
import { chat, detectProvider } from '../src/ai.js';

const HELP = `geosuite-llms-txt — generate an llms.txt from a sitemap.xml

USAGE
  geosuite-llms-txt <sitemap> [options]

ARGUMENTS
  <sitemap>            URL (https://...) or local path to a sitemap.xml.
                       Both flat sitemaps and sitemap-index files are supported.

OPTIONS
  --name=<text>        Site name used as the H1 in the output. Defaults to "Website".
  --summary=<text>     Short summary rendered as a blockquote under the H1.
  --out=<path>         Write output to a file instead of stdout.
  --enrich             Fetch each URL to extract <title> and <meta name=description>.
  --concurrency=<n>    Parallel fetches when --enrich is set. Default: 5.
  --max-entries=<n>    Cap the number of entries processed. Default: unlimited.
  --include-only=<patterns>
                       (0.2+) Comma-separated path prefixes; only URLs whose
                       path starts with one of them are kept. Example:
                       --include-only=/blog,/docs
  --exclude-patterns=<patterns>
                       (0.2+) Comma-separated path prefixes to drop. Wins
                       over --include-only on conflicts. Example:
                       --exclude-patterns=/admin,/preview
  --ai                 (0.2+) Use an LLM to write a one-line description per
                       URL instead of the regex-extracted meta description.
                       Requires OPENAI_API_KEY or ANTHROPIC_API_KEY. Implies
                       --enrich.
  --help, -h           Show this help.

EXAMPLES
  geosuite-llms-txt https://example.com/sitemap.xml --name="Example" --out=llms.txt
  geosuite-llms-txt ./sitemap.xml --enrich --concurrency=10 --max-entries=200
`;

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args._[0]) {
    process.stdout.write(HELP);
    process.exit(args.help ? 0 : 1);
  }

  const source = args._[0];
  const name = args.name;
  const summary = args.summary;
  const outPath = args.out;
  const useAi = !!args.ai;
  const enrich = !!args.enrich || useAi;
  const concurrency = clampInt(args.concurrency, 1, 64, 5);
  const maxEntries = args['max-entries'] ? clampInt(args['max-entries'], 1, 1_000_000, null) : null;

  if (useAi && !detectProvider()) {
    process.stderr.write(
      'error: --ai requested but no LLM API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.\n',
    );
    process.exit(2);
  }

  let { type, entries } = await loadSitemap(source);

  if (type === 'sitemapindex') {
    process.stderr.write(
      `note: input is a sitemap-index with ${entries.length} child sitemap(s); ` +
        `flattening one level...\n`,
    );
    const all = [];
    for (const child of entries) {
      try {
        const sub = await loadSitemap(child.loc);
        if (sub.type === 'sitemap') all.push(...sub.entries);
      } catch (err) {
        process.stderr.write(`warn: failed to load child sitemap ${child.loc}: ${err.message}\n`);
      }
    }
    entries = all;
  }

  // 0.2+ filtering. Applied AFTER fetching the sitemap and BEFORE the
  // max-entries cap so the user keeps control over what counts.
  const includePrefixes = parsePatterns(args['include-only']);
  const excludePrefixes = parsePatterns(args['exclude-patterns']);
  if (includePrefixes.length || excludePrefixes.length) {
    const before = entries.length;
    entries = entries.filter((e) => keepEntry(e.loc, includePrefixes, excludePrefixes));
    process.stderr.write(
      `filtered ${before} → ${entries.length} entries (include=${includePrefixes.length}, exclude=${excludePrefixes.length})\n`,
    );
  }

  if (maxEntries != null && entries.length > maxEntries) {
    entries = entries.slice(0, maxEntries);
  }

  if (enrich) {
    process.stderr.write(`enriching ${entries.length} entries (concurrency=${concurrency})...\n`);
    await runWithConcurrency(entries, concurrency, (e) => enrichEntry(e));
  }

  // After regex enrichment, if --ai is on, ask the LLM for a tighter
  // 1-line description per URL using the title + scraped meta. Falls back
  // gracefully on any per-entry error.
  if (useAi) {
    process.stderr.write(`AI-rewriting ${entries.length} descriptions...\n`);
    await runWithConcurrency(entries, Math.min(concurrency, 4), async (e) => {
      try {
        e.description = await aiDescribeEntry(e);
      } catch {
        // Keep the regex description on failure.
      }
    });
  }

  const groups = groupByPrefix(entries);
  const output = renderLlmsTxt(groups, { name, summary });

  if (outPath) {
    await writeFile(outPath, output, 'utf8');
    process.stderr.write(`wrote ${output.length} bytes to ${outPath}\n`);
  } else {
    process.stdout.write(output);
  }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (const tok of argv) {
    if (tok === '--help' || tok === '-h') {
      out.help = true;
    } else if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      if (eq === -1) {
        out[tok.slice(2)] = true;
      } else {
        out[tok.slice(2, eq)] = tok.slice(eq + 1);
      }
    } else {
      out._.push(tok);
    }
  }
  return out;
}

function clampInt(v, min, max, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parsePatterns(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function keepEntry(loc, includes, excludes) {
  let path;
  try {
    path = new URL(loc).pathname || '/';
  } catch {
    return false;
  }
  for (const prefix of excludes) {
    if (path.startsWith(prefix)) return false;
  }
  if (includes.length === 0) return true;
  for (const prefix of includes) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

async function runWithConcurrency(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        await worker(items[idx]);
      } catch {
        // Per-item failures are tolerated.
      }
    }
  });
  await Promise.all(runners);
}

/**
 * Produce a one-line description for a sitemap entry using the LLM.
 * We only send `loc`, `title`, and the existing meta description (if any)
 * — never the full page body.
 */
async function aiDescribeEntry(entry) {
  const compact = {
    url: entry.loc,
    title: entry.title || '',
    meta_description: entry.description || '',
  };
  const out = await chat(
    [
      {
        role: 'system',
        content:
          'You write a single-line description (under 140 characters, no markdown, no quotes) of a web page that an LLM-powered search engine could cite. Use the title and meta description supplied. If they are empty, fall back to the URL slug. Never invent specifics that the inputs don\'t support.',
      },
      {
        role: 'user',
        content: `Page:\n${JSON.stringify(compact)}`,
      },
    ],
    { maxTokens: 100, temperature: 0.2 },
  );
  return out.replace(/^["'\s]+|["'\s]+$/g, '').slice(0, 200) || entry.description;
}

main(process.argv.slice(2)).catch((err) => {
  process.stderr.write(`error: ${err && err.message ? err.message : err}\n`);
  process.exit(1);
});
