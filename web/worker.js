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
// Page routes:
//   GET /     → locale picked from Accept-Language (it → Italian, else English)
//   GET /en   → English   |   GET /it → Italian
// Asset routes:
//   GET /og.png  /favicon.svg
// API routes:
//   GET /api/generate?url=...    → { site, count, truncated, llmstxt, error }

import { parseSitemap, groupByPrefix, renderLlmsTxt } from '../src/index.js';
import { renderPage } from './page.js';
import OG_PNG from './og.png'; // bundled as ArrayBuffer via the wrangler "Data" rule

const TIMEOUT_MS = 8000;
const MAX_ENTRIES = 2000;
const MAX_INDEX_CHILDREN = 10;
const UA = 'llms-txt-generator-web/1.0 (+https://github.com/TryGeoSuite/llms-txt-generator)';

// A geo "location pin" mark in the GeoSuite accent — inline SVG, no binary.
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b0f17"/><path d="M32 13c-8.3 0-15 6.4-15 14.6C17 38 32 51 32 51s15-13 15-23.4C47 19.4 40.3 13 32 13z" fill="#5b8def"/><circle cx="32" cy="27.5" r="5.6" fill="#0b0f17"/></svg>`;

// '/it' → 'it', '/en' → 'en', '/' → first Accept-Language tag (it → 'it', else 'en').
function pickLang(request, path) {
  if (path === '/it') return 'it';
  if (path === '/en') return 'en';
  const first = (request.headers.get('accept-language') || '').split(',')[0].trim().toLowerCase();
  return first.startsWith('it') ? 'it' : 'en';
}

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
    const path = url.pathname;

    if (path === '/api/generate') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response(JSON.stringify({ error: 'Missing ?url= parameter.' }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      }
      return new Response(JSON.stringify(await generate(target)), { headers: JSON_HEADERS });
    }

    // --- Static assets ---
    if (path === '/og.png') {
      return new Response(OG_PNG, {
        headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
      });
    }
    if (path === '/favicon.svg') {
      return new Response(FAVICON, {
        headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' },
      });
    }

    if (path === '/' || path === '/en' || path === '/it') {
      const lang = pickLang(request, path);
      // '/' is content-negotiated, so it must not be cached language-agnostically.
      const headers = {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
      };
      if (path === '/') headers.vary = 'Accept-Language';
      return new Response(renderPage(lang), { headers });
    }

    return new Response('Not found', { status: 404 });
  },
};
