// "llms.txt Generator" — hosted free tool (Cloudflare Worker).
//
// Reuses the package's pure pipeline — parseSitemap → groupByPrefix →
// renderLlmsTxt — fed a sitemap fetched with the platform `fetch()`. It does
// NOT enrich titles/descriptions (that fetches every page; use the CLI for
// that), so this is the fast "structure-only" llms.txt.
//
// nodejs_compat (see wrangler.toml) lets the package's `node:*` imports resolve
// at bundle time; none are called on this path. fast-xml-parser is bundled.
//
// Routes:
//   GET /                       → the page (web/page.js)
//   GET /api/generate?url=...    → { site, count, truncated, llmstxt, error }

import { parseSitemap, groupByPrefix, renderLlmsTxt } from '../src/index.js';
import { PAGE } from './page.js';

const TIMEOUT_MS = 8000;
const MAX_ENTRIES = 2000;
const MAX_INDEX_CHILDREN = 10;
const UA = 'llms-txt-generator-web/1.0 (+https://github.com/TryGeoSuite/llms-txt-generator)';

function siteUrl(input) {
  let u = String(input || '').trim();
  if (!u) throw new Error('empty url');
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return new URL(u);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/xml, text/xml, */*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

async function generate(input) {
  let u;
  try {
    u = siteUrl(input);
  } catch {
    return { error: 'Please enter a valid URL.' };
  }
  const sitemapUrl = u.pathname.toLowerCase().endsWith('.xml') ? u.toString() : u.origin + '/sitemap.xml';

  let xml;
  try {
    xml = await fetchText(sitemapUrl);
  } catch (e) {
    return { error: 'Could not fetch ' + sitemapUrl + ' — ' + (e && e.name === 'TimeoutError' ? 'timed out' : e.message || 'fetch failed') };
  }

  let parsed;
  try {
    parsed = parseSitemap(xml);
  } catch (e) {
    return { error: 'Not a valid sitemap at ' + sitemapUrl + ' — ' + e.message };
  }

  let entries = parsed.entries;
  if (parsed.type === 'sitemapindex') {
    const merged = [];
    for (const child of entries.slice(0, MAX_INDEX_CHILDREN)) {
      try {
        const cp = parseSitemap(await fetchText(child.loc));
        if (cp.type === 'sitemap') merged.push(...cp.entries);
      } catch {
        // Skip child sitemaps we can't fetch/parse.
      }
    }
    entries = merged;
  }

  const total = entries.length;
  const truncated = total > MAX_ENTRIES;
  if (truncated) entries = entries.slice(0, MAX_ENTRIES);

  const groups = groupByPrefix(entries);
  const name = u.hostname.replace(/^www\./, '');
  const llmstxt = renderLlmsTxt(groups, { name });

  return {
    site: u.origin,
    sitemapUrl,
    isIndex: parsed.type === 'sitemapindex',
    count: entries.length,
    total,
    truncated,
    llmstxt,
    error: null,
  };
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=300',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response(JSON.stringify({ error: 'Missing ?url= parameter.' }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify(await generate(target)), { headers: JSON_HEADERS });
    }

    if (url.pathname === '/') {
      return new Response(PAGE, {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' },
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
