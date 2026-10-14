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
//   GET /og.png
//   GET /favicon.png  /favicon.ico  /favicon.svg (old path)  /apple-touch-icon.png
//                → GeoSuite's favicon (PNG)
//   GET /logos/{chatgpt,gemini,perplexity}.svg → engine logos in the closing panel
// API routes:
//   GET /api/generate?url=...    → { site, count, truncated, llmstxt, error }

import { parseSitemap, groupByPrefix, renderLlmsTxt } from '../src/index.js';
import { renderPage } from './page.js';
import OG_PNG from './og.png'; // bundled as ArrayBuffer via the wrangler "Data" rule
import FAVICON_PNG from './favicon.png'; // GeoSuite's official favicon, 96px
import TOUCH_ICON_PNG from './apple-touch-icon.png'; // same mark, 180px
import LOGO_CHATGPT from './logos/chatgpt.svg'; // bundled as text via the "Text" rule
import LOGO_GEMINI from './logos/gemini.svg';
import LOGO_PERPLEXITY from './logos/perplexity.svg';

const TIMEOUT_MS = 8000;
const MAX_ENTRIES = 2000;
const MAX_INDEX_CHILDREN = 10;
const UA = 'llms-txt-generator-web/1.0 (+https://github.com/TryGeoSuite/llms-txt-generator)';

// The engines named in the closing panel (theme.js ENGINES), same files as the hub.
const ENGINE_LOGOS = { chatgpt: LOGO_CHATGPT, gemini: LOGO_GEMINI, perplexity: LOGO_PERPLEXITY };

// Every favicon path answers with the PNG; /favicon.svg stays for cached links.
const ICONS = {
  '/favicon.png': FAVICON_PNG,
  '/favicon.ico': FAVICON_PNG,
  '/favicon.svg': FAVICON_PNG,
  '/apple-touch-icon.png': TOUCH_ICON_PNG,
};

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
    if (Object.hasOwn(ICONS, path)) {
      return new Response(ICONS[path], {
        headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
      });
    }
    const logo = path.match(/^\/logos\/(chatgpt|gemini|perplexity)\.svg$/);
    if (logo) {
      return new Response(ENGINE_LOGOS[logo[1]], {
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
