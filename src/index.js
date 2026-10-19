// @geosuite/llms-txt-generator
// Library entrypoint. Exports pure functions used by the CLI and by tests.
//
// Pipeline:
//   loadSitemap(urlOrPath)  -> { type, entries }
//   parseSitemap(xmlString) -> { type, entries }
//   filterByRobots(entries, sitemapUrl, opts) -> filtered entries (optional)
//   filterByPrefix(entries, include, exclude) -> filtered entries (optional)
//   selectEntries(entries, maxEntries) -> { entries, total, truncated }
//   enrichEntry(entry, opts) -> entry with .title and .description
//   groupByPrefix(entries)  -> Map<prefix, entries[]>
//   renderLlmsTxt(groups, header) -> string
//
// The GeoSuite platform runs the same pipeline in Python
// (backend/services/tools/llms_txt_service.py). Both sides run the cases in
// test/fixtures/golden-llms-txt.json, so a change that makes them disagree
// fails a test on the side that drifted.

import { readFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { loadRobotsChecker } from './robots.js';

const USER_AGENT = 'geosuite-llms-txt-generator/0.1.0';
const DEFAULT_TIMEOUT_MS = 10_000;

// A sitemap index is flattened one level, reading at most this many child
// sitemaps (same cap as the platform).
export const MAX_INDEX_CHILDREN = 20;

// Output styles, same names as the platform: `full` renders each link with its
// description, `compact` drops the descriptions, `sections-only` keeps just the
// number of entries per section.
export const FORMATS = ['full', 'compact', 'sections-only'];

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  trimValues: true,
  // Keep every value a string: a numeric-looking <loc> or <lastmod> must not
  // turn into a number (the platform's parser keeps text as text).
  parseTagValue: false,
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

  // An empty <urlset></urlset> parses to '' : still a sitemap, with no entries.
  if (parsed.urlset !== undefined) {
    const entries = (parsed.urlset?.url || [])
      .map((u) => ({
        loc: typeof u.loc === 'string' ? u.loc.trim() : '',
        lastmod: u.lastmod ? String(u.lastmod).trim() : undefined,
      }))
      .filter((e) => e.loc);
    return { type: 'sitemap', entries };
  }

  if (parsed.sitemapindex !== undefined) {
    const entries = (parsed.sitemapindex?.sitemap || [])
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
 * Remove entries whose paths are disallowed for User-Agent: * in the site's
 * robots.txt. Fails permissively: if robots.txt cannot be fetched or parsed,
 * all entries are kept unchanged.
 *
 * @param {Array<{ loc: string }>} entries
 * @param {string} sitemapUrl  Any URL from the same origin (used to derive /robots.txt).
 * @param {{ timeoutMs?: number, userAgent?: string, fetch?: typeof fetch }} [opts]
 * @returns {Promise<Array<{ loc: string }>>}
 */
export async function filterByRobots(entries, sitemapUrl, opts = {}) {
  if (!entries.length) return entries;
  const isAllowed = await loadRobotsChecker(sitemapUrl, { userAgent: USER_AGENT, ...opts });
  return entries.filter((e) => {
    try {
      return isAllowed(new URL(e.loc).pathname);
    } catch {
      return true;
    }
  });
}

/**
 * Keep only entries whose URL path starts with one of `include` (all when the
 * list is empty) and none of `exclude`. Excludes win on conflicts.
 *
 * @param {Array<{ loc: string }>} entries
 * @param {string[]} [include]
 * @param {string[]} [exclude]
 */
export function filterByPrefix(entries, include = [], exclude = []) {
  if (!include.length && !exclude.length) return entries;
  return entries.filter((e) => {
    let path;
    try {
      path = new URL(e.loc).pathname || '/';
    } catch {
      return false;
    }
    if (exclude.some((p) => path.startsWith(p))) return false;
    return !include.length || include.some((p) => path.startsWith(p));
  });
}

/**
 * Drop repeated URLs (the first one wins, order kept) and cap the list.
 *
 * @param {Array<{ loc: string }>} entries
 * @param {number|null} [maxEntries]  null or undefined: no cap.
 * @returns {{ entries: Array<{ loc: string }>, total: number, truncated: boolean }}
 */
export function selectEntries(entries, maxEntries = null) {
  const seen = new Set();
  const unique = [];
  for (const e of entries) {
    if (seen.has(e.loc)) continue;
    seen.add(e.loc);
    unique.push(e);
  }
  const total = unique.length;
  if (maxEntries == null || total <= maxEntries) return { entries: unique, total, truncated: false };
  return { entries: unique.slice(0, maxEntries), total, truncated: true };
}

/**
 * Read the page title and meta description out of an HTML document with cheap
 * regexes (no full HTML parser). Both come back on one line, entities decoded;
 * a missing or empty value is null.
 *
 * @param {string} html
 * @returns {{ title: string|null, description: string|null }}
 */
export function extractPageMeta(html) {
  const body = String(html || '');
  const titleMatch = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  // <meta name="description" content="..."> in either attribute order.
  const descMatch =
    body.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
    body.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const title = titleMatch ? oneLine(decodeHtmlEntities(stripTags(titleMatch[1]))) : '';
  const description = descMatch ? oneLine(decodeHtmlEntities(descMatch[1])) : '';
  return { title: title || null, description: description || null };
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
    const meta = extractPageMeta(await res.text());
    if (meta.title) entry.title = meta.title;
    if (meta.description) entry.description = meta.description;
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
  // Sort: "/" first, then by code point (not by locale: the order must not
  // depend on the machine, and it matches the platform's Python sort).
  return new Map(
    [...groups.entries()].sort((a, b) => {
      if (a[0] === '/') return -1;
      if (b[0] === '/') return 1;
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    }),
  );
}

// The first path segment, percent-decoded, so `/perch%C3%A9` and `/perché`
// land in the same section.
function prefixOf(loc) {
  try {
    const u = new URL(loc);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg ? `/${decodeSegment(seg)}` : '/';
  } catch {
    return '/';
  }
}

function decodeSegment(seg) {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
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
 * `format` is one of FORMATS (default `full`; an unknown value renders `full`).
 *
 * @param {{ name?: string, summary?: string, sectionTitles?: Record<string,string>, format?: string }} [header]
 * @returns {string}
 */
export function renderLlmsTxt(groups, header = {}) {
  const lines = [];
  const name = header.name || 'Website';
  const format = FORMATS.includes(header.format) ? header.format : 'full';
  lines.push(`# ${name}`);
  lines.push('');

  if (header.summary) {
    lines.push(`> ${oneLine(header.summary)}`);
    lines.push('');
  }

  for (const [prefix, entries] of groups) {
    const title = sectionTitle(prefix, header.sectionTitles);
    lines.push(`## ${title}`);
    lines.push('');
    if (format === 'sections-only') {
      lines.push(`- ${entries.length} entries`);
      lines.push('');
      continue;
    }
    for (const e of entries) {
      const linkText = e.title && e.title.length > 0 ? e.title : prettyLinkFromUrl(e.loc);
      const safeText = escapeLinkText(oneLine(linkText));
      const base = `- [${safeText}](${e.loc})`;
      lines.push(format === 'full' && e.description ? `${base}: ${oneLine(e.description)}` : base);
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
  // "/blog" -> "Blog", "/docs" -> "Docs", "/case-studies" -> "Case Studies",
  // "/FAQ" -> "FAQ" (only the first letter of each word changes).
  const slug = prefix.replace(/^\//, '');
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function prettyLinkFromUrl(loc) {
  try {
    const u = new URL(loc);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (!last) return u.hostname;
    return decodeSegment(last).replace(/[-_]/g, ' ');
  } catch {
    return loc;
  }
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

// Named entities a page title or description realistically carries (the
// accented vowels of Italian/French/Spanish copy, quotes, dashes). Numeric
// references (&#233; &#xE9;) are all decoded. The platform uses Python's
// html.unescape, which knows every HTML5 name: for the names below the two agree.
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  agrave: 'à', aacute: 'á', acirc: 'â', auml: 'ä', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï', ograve: 'ò', oacute: 'ó', ocirc: 'ô', ouml: 'ö',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', ntilde: 'ñ', ccedil: 'ç', szlig: 'ß',
  Agrave: 'À', Aacute: 'Á', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Iacute: 'Í',
  Ograve: 'Ò', Oacute: 'Ó', Ugrave: 'Ù', Uacute: 'Ú', Ntilde: 'Ñ', Ccedil: 'Ç',
  laquo: '«', raquo: '»', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d',
  ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', middot: '·', bull: '\u2022',
  euro: '\u20ac', copy: '©', reg: '®', trade: '\u2122', deg: '°',
};

function decodeHtmlEntities(s) {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (whole, ref) => {
    if (ref[0] === '#') {
      const code = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return Object.hasOwn(NAMED_ENTITIES, ref) ? NAMED_ENTITIES[ref] : whole;
  });
}

function escapeLinkText(s) {
  // Brackets in link text would break the markdown link syntax.
  return s.replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function oneLine(s) {
  return s.replace(/\s+/g, ' ').trim();
}

export const _internals = { prefixOf, sectionTitle, prettyLinkFromUrl, decodeHtmlEntities, USER_AGENT };
