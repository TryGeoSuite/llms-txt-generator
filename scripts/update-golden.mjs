#!/usr/bin/env node
// Recompute the `expected` blocks of test/fixtures/golden-llms-txt.json from
// the current code. Run it only after an intentional behavior change, read the
// diff, then copy the file to the platform repo
// (geo: backend/tests/fixtures/golden-llms-txt.json) and make its Python
// service give the same answers.
//
//   node scripts/update-golden.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { computeGolden } from '../test/golden-run.js';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures', 'golden-llms-txt.json');
const golden = JSON.parse(await readFile(file, 'utf8'));
for (const section of ['parse', 'page_meta', 'render', 'robots']) {
  for (const c of golden[section]) c.expected = computeGolden(section, c);
}
await writeFile(file, JSON.stringify(golden, null, 2) + '\n');
process.stdout.write(`updated ${file}\n`);
