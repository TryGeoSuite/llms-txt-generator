# Contributing

Thanks for your interest in improving `@geosuite/llms-txt-generator`.

## Ground rules

- Keep the runtime dependency surface minimal. Today we ship with a single
  runtime dep (`fast-xml-parser`) and rely on Node 20+ built-ins (`fetch`,
  `node:fs/promises`, `node:test`). Please don't add deps without an issue
  discussing the trade-off first.
- Tests run with `node --test test/` — no test framework, no transpiler.
- Code style is plain modern ES modules. No TypeScript in the runtime path.
- The output format must stay aligned with the spec at https://llmstxt.org/.

## Local development

```bash
git clone https://github.com/TryGeoSuite/llms-txt-generator
cd llms-txt-generator
npm install
npm test
node bin/cli.js test/fixtures/sitemap-flat.xml --name="Example"
```

## Submitting changes

1. Open an issue describing the bug or feature first when the change is
   non-trivial.
2. Add or update a test in `test/` for any behavior change.
3. Keep PRs focused — one logical change per PR.
4. Update `CHANGELOG.md` under an `## Unreleased` section.

## Reporting bugs

When filing a bug, please include:

- Node version (`node --version`)
- The sitemap source (URL or a minimal anonymized XML snippet)
- The exact CLI invocation
- Expected vs actual output

## License

By contributing you agree that your contributions are licensed under the MIT
License of this repository.
