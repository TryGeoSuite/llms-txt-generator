// @geosuite/llms-txt-generator
// Library entrypoint. Exports pure functions used by the CLI and by tests.
//
// Pipeline:
//   loadSitemap(urlOrPath)  -> { type, entries }
//   parseSitemap(xmlString) -> { type, entries }
//   enrichEntry(entry, opts) -> entry with .title and .description
//   groupByPrefix(entries)  -> Map<prefix, entries[]>
//   renderLlmsTxt(groups, header) -> string

import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const USER_AGENT = 'geosuite-llms-txt-generator/0.1.0';
const DEFAULT_TIMEOUT_MS = 10_000;

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  // Always produce arrays for repeated elements so the parser output is uniform.
  isArray: (name) => name === 'url' || name === 'sitemap',
});

/**
 * Parse a sitemap.xml string. Handles both flat sitemaps (<urlset>) and
 * sitemap-index files (<sitemapindex>).
 *
 * @param {string} xmlString
 * @returns {{ type: 'sitemap'|'sitemapindex', entries: Array<{ loc: string, lastmod?: string }> }}
 */
export function parseSitemap(xmlString) {
  if (typeof xmlString !== 'string' || xmlString.trim() === '') {
    throw new Error('parseSitemap: expected non-empty XML string');
  }
  const parsed = xmlParser.parse(xmlString);

  if (parsed.urlset && parsed.urlset.url) {
    const entries = parsed.urlset.url
      .map((u) => ({
        loc: typeof u.loc === 'string' ? u.loc.trim() : '',
        lastmod: u.lastmod ? String(u.lastmod).trim() : undefined,
      }))
      .filter((e) => e.loc);
    return { type: 'sitemap', entries };
  }

  if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
    const entries = parsed.sitemapindex.sitemap
      .map((s) => ({
        loc: typeof s.loc === 'string' ? s.loc.trim() : '',
        lastmod: s.lastmod ? String(s.lastmod).trim() : undefined,
      }))
      .filter((e) => e.loc);
    return { type: 'sitemapindex', entries };
  }

  throw new Error('parseSitemap: input is neither <urlset> nor <sitemapindex>');
}

/**
 * Load a sitemap from a URL or local file path, returning the parsed result.
 *
 * @param {string} urlOrPath
 * @returns {Promise<{ type: 'sitemap'|'sitemapindex', entries: Array<{ loc: string, lastmod?: string }> }>}
 */
export async function loadSitemap(urlOrPath) {
  if (!urlOrPath || typeof urlOrPath !== 'string') {
    throw new Error('loadSitemap: missing source (URL or path)');
  }

  const isHttp = /^https?:\/\//i.test(urlOrPath);
  let xml;
  if (isHttp) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(urlOrPath, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/xml, text/xml, */*' },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`loadSitemap: HTTP ${res.status} fetching ${urlOrPath}`);
      }
      xml = await res.text();
    } finally {
      clearTimeout(timer);
    }
  } else {
    const abs = resolvePath(urlOrPath);
    xml = await readFile(abs, 'utf8');
  }
  return parseSitemap(xml);
}

/**
 * Fetch the URL of an entry and extract <title> and <meta name="description">
 * via cheap regex (no full HTML parser). Mutates and returns the entry.
 *
 * @param {{ loc: string, title?: string, description?: string }} entry
 * @param {{ timeoutMs?: number, userAgent?: string }} [opts]
 */
export async function enrichEntry(entry, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = opts.userAgent ?? USER_AGENT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(entry.loc, {
      headers: { 'user-agent': userAgent, accept: 'text/html, */*' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return entry;
    const ct = res.headers.get('content-type') || '';
    if (!ct.toLowerCase().includes('html')) return entry;
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      entry.title = decodeHtmlEntities(stripTags(titleMatch[1]).trim());
    }

    // <meta name="description" content="..."> in either attribute order.
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
    if (descMatch) {
      entry.description = decodeHtmlEntities(descMatch[1].trim());
    }
  } catch {
    // Swallow per-entry errors — enrichment is best-effort.
  } finally {
    clearTimeout(timer);
  }
  return entry;
}

/**
 * Group entries by the first path segment of their URL.
 * The site root ("/") becomes the key "/".
 *
 * @param {Array<{ loc: string }>} entries
 * @returns {Map<string, Array<{ loc: string }>>}
 */
export function groupByPrefix(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const prefix = prefixOf(entry.loc);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(entry);
  }
  // Sort: "/" first, then alphabetical.
  return new Map(
    [...groups.entries()].sort((a, b) => {
      if (a[0] === '/') return -1;
      if (b[0] === '/') return 1;
      return a[0].localeCompare(b[0]);
    }),
  );
}

function prefixOf(loc) {
  try {
    const u = new URL(loc);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg ? `/${seg}` : '/';
  } catch {
    return '/';
  }
}

/**
 * Render groups as an llms.txt document.
 *
 * Format (per https://llmstxt.org/):
 *   # Site name
 *   > Optional summary blockquote
 *   ## Section
 *   - [Title](url): description
 *
 * @param {Map<string, Array<{ loc: string, title?: string, description?: string }>>} groups
 * @param {{ name?: string, summary?: string, sectionTitles?: Record<string,string> }} [header]
 * @returns {string}
 */
export function renderLlmsTxt(groups, header = {}) {
  const lines = [];
  const name = header.name || 'Website';
  lines.push(`# ${name}`);
  lines.push('');

  if (header.summary) {
    lines.push(`> ${header.summary}`);
    lines.push('');
  }

  for (const [prefix, entries] of groups) {
    const title = sectionTitle(prefix, header.sectionTitles);
    lines.push(`## ${title}`);
    lines.push('');
    for (const e of entries) {
      const linkText = e.title && e.title.length > 0 ? e.title : prettyLinkFromUrl(e.loc);
      const safeText = escapeLinkText(linkText);
      const base = `- [${safeText}](${e.loc})`;
      lines.push(e.description ? `${base}: ${oneLine(e.description)}` : base);
    }
    lines.push('');
  }

  // Collapse trailing blank lines into a single newline at end of file.
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}

function sectionTitle(prefix, overrides) {
  if (overrides && overrides[prefix]) return overrides[prefix];
  if (prefix === '/') return 'Main';
  // "/blog" -> "Blog", "/docs" -> "Docs", "/case-studies" -> "Case Studies"
  const slug = prefix.replace(/^\//, '');
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function prettyLinkFromUrl(loc) {
  try {
    const u = new URL(loc);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (!last) return u.hostname;
    return last.replace(/[-_]/g, ' ');
  } catch {
    return loc;
  }
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function escapeLinkText(s) {
  // Brackets in link text would break the markdown link syntax.
  return s.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function oneLine(s) {
  return s.replace(/\s+/g, ' ').trim();
}

export const _internals = { prefixOf, sectionTitle, prettyLinkFromUrl, USER_AGENT };
