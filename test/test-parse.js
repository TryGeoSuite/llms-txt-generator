// Tests for @geosuite/llms-txt-generator.
// Runs under `node --test` (Node 20+).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  parseSitemap,
  groupByPrefix,
  renderLlmsTxt,
} from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFile(join(__dirname, 'fixtures', name), 'utf8');

test('parseSitemap: parses a flat <urlset> sitemap', async () => {
  const xml = await fixture('sitemap-flat.xml');
  const result = parseSitemap(xml);
  assert.equal(result.type, 'sitemap');
  assert.equal(result.entries.length, 6);
  assert.equal(result.entries[0].loc, 'https://example.com/');
  assert.equal(result.entries[0].lastmod, '2026-01-15');
  assert.equal(result.entries[2].loc, 'https://example.com/blog/intro-to-llms-txt');
});

test('parseSitemap: parses a <sitemapindex> file', async () => {
  const xml = await fixture('sitemap-index.xml');
  const result = parseSitemap(xml);
  assert.equal(result.type, 'sitemapindex');
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].loc, 'https://example.com/sitemap-pages.xml');
  assert.equal(result.entries[1].loc, 'https://example.com/sitemap-blog.xml');
});

test('parseSitemap: rejects empty input', () => {
  assert.throws(() => parseSitemap(''), /non-empty XML/);
});

test('parseSitemap: rejects unknown root element', () => {
  assert.throws(
    () => parseSitemap('<?xml version="1.0"?><nope/>'),
    /neither <urlset> nor <sitemapindex>/,
  );
});

test('groupByPrefix: groups by first path segment with "/" first', () => {
  const entries = [
    { loc: 'https://example.com/' },
    { loc: 'https://example.com/about' },
    { loc: 'https://example.com/blog/a' },
    { loc: 'https://example.com/blog/b' },
    { loc: 'https://example.com/docs/x' },
  ];
  const groups = groupByPrefix(entries);
  const keys = [...groups.keys()];
  assert.deepEqual(keys, ['/', '/about', '/blog', '/docs']);
  assert.equal(groups.get('/blog').length, 2);
  assert.equal(groups.get('/').length, 1);
});

test('renderLlmsTxt: renders H1, blockquote, and list items per spec', () => {
  const groups = new Map([
    ['/', [{ loc: 'https://example.com/', title: 'Home', description: 'Welcome.' }]],
    [
      '/blog',
      [
        { loc: 'https://example.com/blog/a', title: 'Post A', description: 'About A' },
        { loc: 'https://example.com/blog/b', title: 'Post B' },
      ],
    ],
  ]);
  const out = renderLlmsTxt(groups, { name: 'Example', summary: 'A demo site.' });
  const expected =
    '# Example\n' +
    '\n' +
    '> A demo site.\n' +
    '\n' +
    '## Main\n' +
    '\n' +
    '- [Home](https://example.com/): Welcome.\n' +
    '\n' +
    '## Blog\n' +
    '\n' +
    '- [Post A](https://example.com/blog/a): About A\n' +
    '- [Post B](https://example.com/blog/b)\n';
  assert.equal(out, expected);
});

test('renderLlmsTxt: end-to-end from fixture', async () => {
  const xml = await fixture('sitemap-flat.xml');
  const { entries } = parseSitemap(xml);
  const groups = groupByPrefix(entries);
  const out = renderLlmsTxt(groups, { name: 'Example' });
  assert.match(out, /^# Example\n/);
  assert.match(out, /## Main/);
  assert.match(out, /## Blog/);
  assert.match(out, /## Docs/);
  assert.match(out, /- \[about\]\(https:\/\/example\.com\/about\)/);
});

test('renderLlmsTxt: escapes brackets in link text', () => {
  const groups = new Map([
    ['/', [{ loc: 'https://example.com/', title: '[hot] news' }]],
  ]);
  const out = renderLlmsTxt(groups, { name: 'X' });
  assert.match(out, /- \[\\\[hot\\\] news\]\(https:\/\/example\.com\/\)/);
});
