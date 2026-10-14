// The single-page UI served at `/`. Bilingual (en/it): the worker picks a locale
// and calls renderPage(lang); all user-facing copy lives in the S dictionary
// below. Product/standard names (llms.txt, sitemap.xml, robots.txt) stay as-is.
//
// It wears GeoSuite's design (theme.js, copied from the hub at
// tools.trygeosuite.it), so the tool and the hub read as one site.
//
// The page has interactive client-side JS that fetches /api/generate and builds
// the result HTML. Its visitor-visible strings are localized via an I18N object
// injected per-language into the inline <script> (see S[lang].js). API field
// names, URLs and code are NOT translated.

import { FONTS, BASE_CSS, ENGINES } from './theme.js';

const BASE = 'https://llmstxt-generator.geosuite.workers.dev';
const HUB = 'https://tools.trygeosuite.it';
const GH = 'https://github.com/TryGeoSuite/llms-txt-generator';
const NPM = 'https://www.npmjs.com/package/@geosuite/llms-txt-generator';
const ANALYSIS = 'https://trygeosuite.it/analisi-gratuita?utm_source=geosuite-open&utm_medium=tool&utm_campaign=llmstxt-generator';
const CMD = 'npx @geosuite/llms-txt-generator &lt;sitemap&gt;';

// State icons, same drawing as the hub's check page. The circle takes the state
// color from CSS; the text next to it always says the same thing.
const ICONS = {
  ok: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M6 10.5l2.6 2.6L14 7.7" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  partial: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M6 10h8" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
  missing: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M7 7l6 6M13 7l-6 6" fill="none" stroke-width="2" stroke-linecap="round"/></svg>',
};

// A short llms.txt, the shape the tool returns: shown next to the form.
const SAMPLE = `# example.com

## Blog

- [What is llms.txt](https://example.com/blog/llms)
- [GEO vs SEO](https://example.com/blog/geo)

## Docs

- [Getting started](https://example.com/docs/start)
- [API reference](https://example.com/docs/api)`;

const S = {
  en: {
    title: 'llms.txt Generator: turn your sitemap into an llms.txt',
    desc: 'Paste a site URL and get an llms.txt, the proposed standard that tells AI models which pages matter. Built from your sitemap.xml, in seconds.',
    tools: 'Free tools',
    eyebrow: 'A free GeoSuite tool',
    h1: 'Turn your sitemap into an llms.txt',
    lead: `Paste a site and get its <a href="https://llmstxt.org/" target="_blank" rel="noopener">llms.txt</a>: the curated index that tells AI models which pages matter, built from your <code>sitemap.xml</code>.`,
    label: 'Website or sitemap URL',
    placeholder: 'https://example.com',
    generate: 'Generate',
    facts: ['Free', 'No login, no tracking', 'Open source (MIT)'],
    hint: `We fetch only your <code>sitemap.xml</code> (and its child sitemaps). For page titles and descriptions use the CLI with <code>--enrich</code>.`,
    sampleLabel: 'What you get',
    sampleMeta: 'llms.txt, grouped by section',
    cliTitle: 'Run it from your terminal',
    cliText: `The same generator as a zero-dependency CLI on npm. Add <code>--enrich</code> and it also reads each page for its title and description.`,
    star: 'Star on GitHub',
    copyLabel: 'Copy the command',
    ctaTitle: 'Readable is step one. Recommended is the goal.',
    ctaText: 'An llms.txt helps AI models find your best pages. GeoSuite asks ChatGPT, Gemini and Perplexity the questions your customers really ask, and tells you whether you are recommended, who wins instead and what to fix first. The report arrives by email.',
    ctaButton: 'Get the free analysis',
    footer: `Open source (MIT) by <a href="https://github.com/matte97p">Matteo Perino</a>, a <a href="https://trygeosuite.it">GeoSuite</a> tool. Code on <a href="${GH}">GitHub</a>, package on <a href="${NPM}">npm</a>.`,
    // Strings used by the inline client script.
    js: {
      forValue: 'llms.txt for ',
      pages: ' pages',
      sitemapIndex: ' (sitemap index)',
      copy: 'Copy',
      copied: 'Copied',
      download: 'Download',
      truncatedPre: 'Large sitemap: showing the first ',
      truncatedMid: ' of ',
      truncatedPost: ' URLs.',
      reading: 'Reading ',
      readingSuffix: '…',
      networkError: 'Network error, try again.',
      ready: 'Ready',
      errorLabel: 'Error',
    },
  },
  it: {
    title: 'Generatore llms.txt: trasforma la tua sitemap in un llms.txt',
    desc: 'Incolla l\'URL di un sito e ottieni un llms.txt, lo standard proposto che dice ai modelli AI quali pagine contano. Costruito dal tuo sitemap.xml in pochi secondi.',
    tools: 'Strumenti gratuiti',
    eyebrow: 'Uno strumento gratuito di GeoSuite',
    h1: 'Trasforma la tua sitemap in un llms.txt',
    lead: `Incolla un sito e ottieni il suo <a href="https://llmstxt.org/" target="_blank" rel="noopener">llms.txt</a>: l'indice curato che dice ai modelli AI quali pagine contano, costruito dal tuo <code>sitemap.xml</code>.`,
    label: 'URL del sito o della sitemap',
    placeholder: 'https://esempio.it',
    generate: 'Genera',
    facts: ['Gratis', 'Senza login né tracciamento', 'Open source (MIT)'],
    hint: `Scarichiamo solo il tuo <code>sitemap.xml</code> (e le sitemap figlie). Per titoli e descrizioni delle pagine usa la CLI con <code>--enrich</code>.`,
    sampleLabel: 'Cosa ottieni',
    sampleMeta: 'llms.txt, diviso per sezioni',
    cliTitle: 'Usalo dal terminale',
    cliText: `Lo stesso generatore, come CLI su npm senza dipendenze. Con <code>--enrich</code> legge anche ogni pagina per prenderne titolo e descrizione.`,
    star: 'Stella su GitHub',
    copyLabel: 'Copia il comando',
    ctaTitle: 'Farsi leggere è il primo passo. Farsi consigliare è l\'obiettivo.',
    ctaText: 'Un llms.txt aiuta i modelli AI a trovare le tue pagine migliori. GeoSuite fa a ChatGPT, Gemini e Perplexity le domande che i tuoi clienti fanno davvero, e ti dice se ti consigliano, chi vince al posto tuo e cosa correggere per primo. Il report arriva via mail.',
    ctaButton: 'Richiedi l\'analisi gratuita',
    footer: `Open source (MIT) di <a href="https://github.com/matte97p">Matteo Perino</a>, uno strumento di <a href="https://trygeosuite.it">GeoSuite</a>. Codice su <a href="${GH}">GitHub</a>, pacchetto su <a href="${NPM}">npm</a>.`,
    // Strings used by the inline client script.
    js: {
      forValue: 'llms.txt per ',
      pages: ' pagine',
      sitemapIndex: ' (indice sitemap)',
      copy: 'Copia',
      copied: 'Copiato',
      download: 'Scarica',
      truncatedPre: 'Sitemap grande: mostro i primi ',
      truncatedMid: ' di ',
      truncatedPost: ' URL.',
      reading: 'Lettura di ',
      readingSuffix: '…',
      networkError: 'Errore di rete, riprova.',
      ready: 'Pronto',
      errorLabel: 'Errore',
    },
  },
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// lang: 'en' | 'it'.
export function renderPage(lang) {
  const t = S[lang] || S.en;
  const facts = t.facts.map((f) => `<li>${ICONS.ok}${f}</li>`).join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t.title}</title>
<meta name="description" content="${t.desc}">
<link rel="canonical" href="${BASE}/${lang}">
<link rel="alternate" hreflang="en" href="${BASE}/en">
<link rel="alternate" hreflang="it" href="${BASE}/it">
<link rel="alternate" hreflang="x-default" href="${BASE}/">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="GeoSuite Open">
<meta property="og:title" content="${t.title}">
<meta property="og:description" content="${t.desc}">
<meta property="og:url" content="${BASE}/${lang}">
<meta property="og:image" content="${BASE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${lang === 'it' ? 'it_IT' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t.title}">
<meta name="twitter:description" content="${t.desc}">
<meta name="twitter:image" content="${BASE}/og.png">
${FONTS}
<style>
${BASE_CSS}
  code { font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:.875em; }
  .lead code, .note code, .cli p code { color:var(--ink); }
  .note { color:var(--ink-3); font-size:.875rem; margin:12px 0 0; max-width:60ch; }
  .hero > * { min-width:0; }
  .sample { padding:20px; margin:0; }
  .sample figcaption { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; margin:0 0 12px; }
  .sample pre { margin:0; }

  pre.gen { margin:0; padding:14px 16px; border-radius:8px; background:var(--sunk); border:1px solid var(--line); color:var(--ink); overflow:auto; max-height:460px; font:.8125rem/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space:pre; }

  #out { margin-top:32px; }
  #out:empty { display:none; }
  .result { padding:20px; }
  .meta { display:flex; align-items:center; gap:8px 12px; flex-wrap:wrap; margin:0 0 14px; }
  .meta h2 { margin:0; font-size:1.125rem; letter-spacing:-.01em; overflow-wrap:anywhere; }
  .meta .sub { color:var(--ink-3); font-size:.875rem; font-variant-numeric:tabular-nums; }
  .actions { display:flex; gap:8px; margin-left:auto; }
  .state { display:inline-flex; align-items:center; gap:6px; font-size:.8125rem; font-weight:600; padding:2px 10px 2px 6px; border-radius:999px; }
  .state svg, .notice svg { width:16px; height:16px; flex:none; }
  .state svg path, .notice svg path { stroke:#fff; }
  .state.ok { color:var(--ok); background:var(--ok-soft); } .state.ok svg circle { fill:var(--ok); }
  .notice { display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border-radius:8px; font-size:.9375rem; color:var(--ink); margin:0 0 14px; }
  .notice svg { margin-top:3px; }
  .notice.warn { background:var(--warn-soft); border:1px solid var(--line); border-left:3px solid var(--warn); } .notice.warn svg circle { fill:var(--warn); }
  .notice.crit { background:var(--crit-soft); border:1px solid var(--line); border-left:3px solid var(--crit); margin:0; overflow-wrap:anywhere; } .notice.crit svg circle { fill:var(--crit); }
  .notice strong { font-weight:600; }
  .loading { padding:18px 20px; display:flex; align-items:center; gap:12px; color:var(--ink-2); overflow-wrap:anywhere; }
  .spinner { width:18px; height:18px; flex:none; border-radius:50%; border:2px solid var(--line-2); border-top-color:var(--accent); animation:spin .8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation:none; } }

  .cli { margin-top:32px; padding:24px 28px; }
  .cli h2 { font-size:1.25rem; line-height:1.25; letter-spacing:-.015em; margin:0 0 6px; }
  .cli p { color:var(--ink-2); margin:0 0 16px; max-width:62ch; }
  .cmd { display:flex; align-items:center; gap:8px; padding:4px 4px 4px 12px; background:var(--surface-2); border:1px solid var(--line); border-radius:8px; margin:0 0 16px; }
  .cmd code { flex:1; min-width:0; overflow-x:auto; white-space:nowrap; color:var(--ink-2); font-size:.8125rem; padding:6px 0; }
  .cmd button { flex:none; min-height:36px; padding:4px 12px; font-size:.8125rem; }
  .links { display:flex; gap:8px; flex-wrap:wrap; }
  .links a { text-decoration:none; display:inline-flex; align-items:center; gap:6px; }
  .links svg { width:16px; height:16px; }
  .cta { margin-top:16px; }
  /* One column: once a result is on screen, the sample above it only pushes it down. */
  @media (max-width:899px) { .hero:has(~ #out:not(:empty)) .sample { display:none; } }
  @media (max-width:640px) {
    .result, .sample { padding:16px; }
    .cli { padding:20px; }
    .actions { margin-left:0; width:100%; }
    .actions .ghost { flex:1; }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="bar">
    <a class="brand" href="https://trygeosuite.it">GeoSuite</a>
    <nav aria-label="Site">
      <a href="${HUB}/${lang}">${t.tools}</a>
      <a href="/en"${lang === 'en' ? ' aria-current="page"' : ''} hreflang="en">EN</a>
      <a href="/it"${lang === 'it' ? ' aria-current="page"' : ''} hreflang="it">IT</a>
    </nav>
  </header>

  <main>
    <div class="hero">
      <div>
        <p class="eyebrow">${t.eyebrow}</p>
        <h1>${t.h1}</h1>
        <p class="lead">${t.lead}</p>
        <form class="urlform" id="f">
          <label for="u">${t.label}</label>
          <input id="u" name="url" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="${t.placeholder}">
          <button class="primary" id="go" type="submit">${t.generate}</button>
        </form>
        <ul class="facts">${facts}</ul>
        <p class="note">${t.hint}</p>
      </div>
      <figure class="panel sample">
        <figcaption><span class="label">${t.sampleLabel}</span><span class="ex-meta">${t.sampleMeta}</span></figcaption>
        <pre class="gen">${esc(SAMPLE)}</pre>
      </figure>
    </div>

    <div id="out" aria-live="polite"></div>

    <section class="panel cli" aria-labelledby="cli-head">
      <h2 id="cli-head">${t.cliTitle}</h2>
      <p>${t.cliText}</p>
      <div class="cmd"><code>${CMD}</code></div>
      <div class="links">
        <a class="ghost" href="${GH}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>${t.star}</a>
        <a class="ghost" href="${NPM}" target="_blank" rel="noopener">npm</a>
      </div>
    </section>

    <section class="panel cta">
      <div>
        <h2>${t.ctaTitle}</h2>
        <p>${t.ctaText}</p>
        ${ENGINES}
      </div>
      <a class="primary" href="${ANALYSIS}" target="_blank" rel="noopener">${t.ctaButton}</a>
    </section>
  </main>

  <footer>${t.footer}</footer>
</div>

<script>var I18N = ${JSON.stringify(t.js)}; var ICONS = ${JSON.stringify(ICONS)}; var COPY_LABEL = ${JSON.stringify(t.copyLabel)};</script>
<script>
  var out = document.getElementById('out');
  var input = document.getElementById('u');
  var btn = document.getElementById('go');
  var lastText = '';

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function flash(b){
    b.textContent = I18N.copied;
    setTimeout(function(){ b.textContent = I18N.copy; }, 1500);
  }

  function errorBox(msg){
    // The API joins cause and detail with a long dash: show a colon instead.
    msg = String(msg).replace(/\\s*\\u2014\\s*/g, ': ');
    return '<div class="notice crit" role="alert">' + ICONS.missing +
      '<span><strong>' + I18N.errorLabel + ':</strong> ' + esc(msg) + '</span></div>';
  }

  function render(r){
    if (r.error){
      out.innerHTML = errorBox(r.error);
      return;
    }
    lastText = r.llmstxt || '';
    var warn = r.truncated
      ? '<div class="notice warn">' + ICONS.partial + '<span>' + I18N.truncatedPre + r.count + I18N.truncatedMid + r.total + I18N.truncatedPost + '</span></div>'
      : '';
    out.innerHTML =
      '<div class="panel result">' +
        warn +
        '<div class="meta">' +
          '<span class="state ok">' + ICONS.ok + I18N.ready + '</span>' +
          '<h2>' + I18N.forValue + esc(r.site) + '</h2>' +
          '<span class="sub">' + r.count + I18N.pages + (r.isIndex ? I18N.sitemapIndex : '') + '</span>' +
          '<span class="actions">' +
            '<button class="ghost" id="copy" type="button">' + I18N.copy + '</button>' +
            '<button class="ghost" id="dl" type="button">' + I18N.download + '</button>' +
          '</span>' +
        '</div>' +
        '<pre class="gen">' + esc(lastText) + '</pre>' +
      '</div>';

    document.getElementById('copy').addEventListener('click', function(){
      var b = this;
      navigator.clipboard.writeText(lastText).then(function(){ flash(b); });
    });
    document.getElementById('dl').addEventListener('click', function(){
      var blob = new Blob([lastText], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'llms.txt';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
  }

  function run(url){
    if (!url) return;
    btn.disabled = true;
    out.innerHTML = '<div class="panel loading"><span class="spinner" aria-hidden="true"></span><span>' + I18N.reading + esc(url) + I18N.readingSuffix + '</span></div>';
    fetch('/api/generate?url=' + encodeURIComponent(url))
      .then(function(res){ return res.json(); })
      .then(function(r){ render(r); })
      .catch(function(){ out.innerHTML = errorBox(I18N.networkError); })
      .finally(function(){ btn.disabled = false; });
  }

  document.getElementById('f').addEventListener('submit', function(e){
    e.preventDefault();
    var url = input.value.trim();
    if (url){ history.replaceState(null, '', '?url=' + encodeURIComponent(url)); run(url); }
  });

  // The npx command: a copy button, only where the clipboard API exists.
  if (navigator.clipboard) {
    document.querySelectorAll('.cmd').forEach(function(box){
      var cmd = box.querySelector('code').textContent.trim();
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ghost'; b.textContent = I18N.copy; b.setAttribute('aria-label', COPY_LABEL);
      b.addEventListener('click', function(){
        navigator.clipboard.writeText(cmd).then(function(){ flash(b); }).catch(function(){});
      });
      box.appendChild(b);
    });
  }

  var shared = new URLSearchParams(location.search).get('url');
  if (shared){ input.value = shared; run(shared); }
</script>
</body>
</html>`;
}
