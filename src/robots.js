// Minimal robots.txt checker.
// Fetches /robots.txt and returns an isAllowed(path) predicate for a user
// agent (default `*`). Zero runtime dependencies; fails permissively on any
// error.
//
// The rules are the GeoSuite platform's (backend/services/tools/
// robots_check_service.py, `is_url_allowed`), checked by the golden cases:
//   - consecutive User-agent lines share one group; a rule line closes it;
//   - groups naming the agent win over `*` groups;
//   - inside a group the longest matching pattern wins, Allow on a tie;
//   - the first group with a matching rule decides; no match means allowed;
//   - `*` matches anything, a final `$` anchors the end, and both the
//     pattern and the path are percent-decoded before matching.
//
// The same file ships in llms-txt-generator and sitemap-builder: keep them
// identical.

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_USER_AGENT = 'geosuite-robots-check';

/**
 * Fetch /robots.txt from the origin of `siteUrl` and return a path-checker.
 * Returns `() => true` (allow all) when robots.txt can't be fetched.
 *
 * @param {string} siteUrl  Any URL on the target site.
 * @param {{ timeoutMs?: number, userAgent?: string, fetch?: typeof fetch }} [opts]
 * @returns {Promise<(path: string) => boolean>}
 */
export async function loadRobotsChecker(siteUrl, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const userAgent = opts.userAgent ?? DEFAULT_USER_AGENT;
  const doFetch = opts.fetch ?? fetch;
  let origin;
  try {
    const u = new URL(siteUrl);
    origin = `${u.protocol}//${u.host}`;
  } catch {
    return () => true;
  }

  let body;
  try {
    const res = await doFetch(`${origin}/robots.txt`, {
      headers: { 'user-agent': userAgent, accept: 'text/plain, */*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return () => true;
    body = await res.text();
  } catch {
    return () => true;
  }

  const groups = parseRobots(body);
  if (!groups.length) return () => true;
  return (path) => isPathAllowed(groups, path);
}

/**
 * Parse robots.txt into groups of user agents and their Allow/Disallow rules.
 *
 * @param {string} raw
 * @returns {Array<{ agents: string[], rules: Array<{ allow: boolean, pattern: string }> }>}
 */
export function parseRobots(raw) {
  const groups = [];
  let current = null;
  let lastWasRule = false;
  for (const rawLine of String(raw || '').split(/\r\n|\r|\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line || !line.includes(':')) continue;
    const colon = line.indexOf(':');
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!value) continue;
      if (!current || lastWasRule) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
      lastWasRule = false;
    } else if (key === 'allow' || key === 'disallow') {
      if (!current) continue;
      current.rules.push({ allow: key === 'allow', pattern: value });
      lastWasRule = true;
    }
    // Sitemap, Crawl-delay, Host, Content-Signal... neither apply nor split groups.
  }
  return groups;
}

/**
 * Is `path` allowed for `agent` under the parsed groups?
 *
 * @param {ReturnType<typeof parseRobots>} groups
 * @param {string} path  URL path (no query).
 * @param {string} [agent]
 */
export function isPathAllowed(groups, path, agent = '*') {
  if (!groups || !groups.length) return true;
  const token = agent.toLowerCase();
  const specific = [];
  const wildcard = [];
  for (const g of groups) {
    const agents = g.agents.map((a) => a.toLowerCase());
    if (agents.includes(token)) specific.push(g);
    else if (agents.includes('*')) wildcard.push(g);
  }
  const pool = specific.length ? specific : wildcard;
  const target = path || '/';
  for (const g of pool) {
    let best = null;
    for (const rule of g.rules) {
      if (!pathMatches(rule.pattern, target)) continue;
      const len = rule.pattern.length;
      if (!best || len > best.len || (len === best.len && rule.allow && !best.allow)) {
        best = { len, allow: rule.allow };
      }
    }
    if (best) return best.allow;
  }
  return true;
}

// robots.txt wildcard matching: * = any chars, a final $ = must end here.
// An empty pattern matches nothing.
function pathMatches(pattern, path) {
  if (!pattern) return false;
  const p = percentDecode(pattern);
  const endAnchor = p.endsWith('$');
  const body = endAnchor ? p.slice(0, -1) : p;
  const re = new RegExp(
    '^' +
      body
        .split('*')
        .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      (endAnchor ? '$' : ''),
  );
  return re.test(percentDecode(path));
}

function percentDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
