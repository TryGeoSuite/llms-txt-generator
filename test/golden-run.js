// Runs one golden case through the package code. Shared by the golden test and
// scripts/update-golden.mjs, so both read the cases the same way.

import { parseSitemap, selectEntries, groupByPrefix, renderLlmsTxt, extractPageMeta } from '../src/index.js';
import { parseRobots, isPathAllowed } from '../src/robots.js';

export function computeGolden(section, c) {
  if (section === 'parse') {
    try {
      const { type, entries } = parseSitemap(c.xml);
      return { kind: type, entries: entries.map((e) => ({ loc: e.loc, lastmod: e.lastmod ?? null })) };
    } catch {
      return { error: true };
    }
  }
  if (section === 'page_meta') return extractPageMeta(c.html);
  if (section === 'render') {
    const { entries, truncated } = selectEntries(
      c.entries.map((e) => ({ ...e })),
      c.max_entries,
    );
    const content = renderLlmsTxt(groupByPrefix(entries), {
      name: c.site_name,
      summary: c.summary,
      format: c.format,
    });
    return { content, entries_count: entries.length, truncated };
  }
  if (section === 'robots') {
    const groups = parseRobots(c.robots_txt);
    return Object.fromEntries(c.paths.map((p) => [p, isPathAllowed(groups, p, c.agent)]));
  }
  throw new Error(`unknown golden section ${section}`);
}
