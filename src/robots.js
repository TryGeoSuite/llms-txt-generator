// Minimal robots.txt checker for llms-txt-generator.
// Fetches /robots.txt and returns an isAllowed(path) predicate that applies
// longest-match semantics for User-Agent: *. Uses fetch (same as index.js).
// Zero runtime dependencies; fails permissively on any error.

const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = 'geosuite-llms-txt-generator';

/**
 * Fetch /robots.txt from the origin inferred from `sitemapUrl` and return a
 * path-checker. Returns `() => true` (allow all) on any error.
 *
 * @param {string} sitemapUrl  Any URL on the target site.
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<(path: string) => boolean>}
 */
export async function loadRobotsChecker(sitemapUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let origin;
  try {
    const u = new URL(sitemapUrl);
    origin = `${u.protocol}//${u.host}`;
  } catch {
    return () => true;
  }

  let body;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/plain, */*' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return () => true;
    body = await res.text();
  } catch {
    return () => true;
  }

  const disallowed = parseWildcardDisallowed(body);
  if (!disallowed.length) return () => true;
  return (path) => !matchesAny(path, disallowed);
}

// ---- parser ------------------------------------------------------------------

function parseWildcardDisallowed(raw) {
  const out = [];
  let inWildcard = false;
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line || !line.includes(':')) continue;
    const colon = line.indexOf(':');
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      inWildcard = val === '*';
    } else if (key === 'disallow' && inWildcard && val) {
      out.push(val);
    }
  }
  return out;
}

// Longest-matching pattern wins; returns true if path is blocked.
function matchesAny(path, patterns) {
  let winner = null;
  for (const p of patterns) {
    if (pathMatches(p, path) && (!winner || p.length > winner.length)) winner = p;
  }
  return winner !== null;
}

// robots.txt wildcard matching: * = any chars, $ = must end here.
function pathMatches(pattern, path) {
  if (!pattern) return false;
  const endAnchor = pattern.endsWith('$');
  const body = endAnchor ? pattern.slice(0, -1) : pattern;
  const re = new RegExp(
    '^' +
      body
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      (endAnchor ? '$' : ''),
  );
  try {
    return re.test(decodeURIComponent(path));
  } catch {
    return re.test(path);
  }
}
