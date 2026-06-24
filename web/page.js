// The single-page UI served at `/`. Bilingual (en/it): the worker picks a locale
// and calls renderPage(lang); all user-facing copy lives in the S dictionary
// below. Product/standard names (llms.txt, sitemap.xml, robots.txt) stay as-is.
//
// The page has interactive client-side JS that fetches /api/generate and builds
// the result HTML. Its visitor-visible strings are localized via an I18N object
// injected per-language into the inline <script> (see S[lang].js). API field
// names, URLs and code are NOT translated.

const BASE = 'https://llmstxt-generator.geosuite.workers.dev';

const S = {
  en: {
    title: 'llms.txt Generator — turn your sitemap into an llms.txt',
    desc: 'Paste a site URL and get an llms.txt — the proposed standard that tells AI models which pages matter. Built from your sitemap.xml, in seconds.',
    h1: '📄 llms.txt Generator',
    lead: `Turn any site's <code>sitemap.xml</code> into an <a href="https://llmstxt.org/" target="_blank" rel="noopener" style="color:var(--accent)">llms.txt</a> — the curated index that tells AI models which pages matter.`,
    promo: `<strong>Built by GeoSuite</strong> — the AI-visibility platform that measures &amp; improves how ChatGPT, Gemini, Claude &amp; Perplexity describe your brand.`,
    cta: 'Explore GeoSuite →',
    star: '★ Star on GitHub',
    placeholder: 'https://example.com',
    generate: 'Generate',
    hint: `No login, no tracking. We fetch only your <code>sitemap.xml</code> (and child sitemaps). Titles &amp; descriptions need the CLI's <code>--enrich</code>.`,
    footer: `Open source (MIT): <a href="https://github.com/TryGeoSuite/llms-txt-generator">GitHub</a>
    · <a href="https://www.npmjs.com/package/@geosuite/llms-txt-generator">npm</a>
    · <code>npx @geosuite/llms-txt-generator &lt;sitemap&gt;</code><br>
    Built by <a href="https://github.com/matte97p">Matteo Perino</a> · a <a href="https://trygeosuite.it">GeoSuite</a> open-source tool.`,
    // Strings used by the inline client script.
    js: {
      forValue: 'llms.txt for ',
      pages: ' pages',
      sitemapIndex: ' (sitemap index)',
      copy: 'Copy',
      copied: 'Copied ✓',
      download: 'Download',
      truncatedPre: '⚠️ Large sitemap — showing the first ',
      truncatedMid: ' of ',
      truncatedPost: ' URLs.',
      reading: 'Reading ',
      readingSuffix: ' …',
      networkError: 'Network error — try again.',
    },
  },
  it: {
    title: 'Generatore llms.txt — trasforma la tua sitemap in un llms.txt',
    desc: 'Incolla l\'URL di un sito e ottieni un llms.txt — lo standard proposto che dice ai modelli AI quali pagine contano. Costruito dal tuo sitemap.xml, in pochi secondi.',
    h1: '📄 Generatore llms.txt',
    lead: `Trasforma il <code>sitemap.xml</code> di qualsiasi sito in un <a href="https://llmstxt.org/" target="_blank" rel="noopener" style="color:var(--accent)">llms.txt</a> — l'indice curato che dice ai modelli AI quali pagine contano.`,
    promo: `<strong>Creato da GeoSuite</strong> — la piattaforma di visibilità AI che misura e migliora come ChatGPT, Gemini, Claude e Perplexity descrivono il tuo brand.`,
    cta: 'Scopri GeoSuite →',
    star: '★ Stella su GitHub',
    placeholder: 'https://esempio.it',
    generate: 'Genera',
    hint: `Niente login, niente tracciamento. Scarichiamo solo il tuo <code>sitemap.xml</code> (e le sitemap figlie). Titoli e descrizioni richiedono il <code>--enrich</code> della CLI.`,
    footer: `Open source (MIT): <a href="https://github.com/TryGeoSuite/llms-txt-generator">GitHub</a>
    · <a href="https://www.npmjs.com/package/@geosuite/llms-txt-generator">npm</a>
    · <code>npx @geosuite/llms-txt-generator &lt;sitemap&gt;</code><br>
    Creato da <a href="https://github.com/matte97p">Matteo Perino</a> · uno strumento open-source <a href="https://trygeosuite.it">GeoSuite</a>.`,
    // Strings used by the inline client script.
    js: {
      forValue: 'llms.txt per ',
      pages: ' pagine',
      sitemapIndex: ' (indice sitemap)',
      copy: 'Copia',
      copied: 'Copiato ✓',
      download: 'Scarica',
      truncatedPre: '⚠️ Sitemap grande — mostro i primi ',
      truncatedMid: ' di ',
      truncatedPost: ' URL.',
      reading: 'Lettura di ',
      readingSuffix: ' …',
      networkError: 'Errore di rete — riprova.',
    },
  },
};

// lang: 'en' | 'it'.
export function renderPage(lang) {
  const t = S[lang] || S.en;

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
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
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
<style>
  :root {
    --bg: #0b0f17; --panel: #131a26; --line: #243042; --text: #e7edf5;
    --muted: #8b9bb4; --accent: #5b8def; --green: #3fb96b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { position: relative; max-width: 820px; margin: 0 auto; padding: 48px 20px 80px; }
  .lang { position: absolute; top: 18px; right: 20px; display: flex; gap: 6px; font-size: .8rem; }
  .lang a { color: var(--muted); text-decoration: none; padding: 4px 9px; border-radius: 7px; border: 1px solid transparent; }
  .lang a.on { color: var(--text); border-color: var(--line); background: var(--panel); }
  .lang a:hover { color: var(--text); }
  header h1 { font-size: 1.7rem; margin: 0 0 6px; letter-spacing: -0.02em; }
  header p { color: var(--muted); margin: 0 0 24px; }
  .promo { margin: 0 0 26px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); display: flex; align-items: center; gap: 18px; justify-content: space-between; flex-wrap: wrap; }
  .promo .txt { font-size: .98rem; color: var(--text); flex: 1; min-width: 220px; }
  .promo .txt strong { color: var(--accent); }
  .promo-actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .promo-cta { background: var(--accent); color: #fff; font-weight: 600; font-size: .95rem; padding: 11px 18px; border-radius: 10px; text-decoration: none; white-space: nowrap; }
  .promo-cta:hover { opacity: .9; }
  .gh { font-size: .95rem; font-weight: 600; padding: 9px 16px; border: 1px solid var(--accent); border-radius: 9px; color: var(--accent); text-decoration: none; white-space: nowrap; }
  .gh:hover { background: var(--accent); color: #fff; }
  form { display: flex; gap: 10px; margin-bottom: 8px; }
  input[type=url] {
    flex: 1; padding: 13px 15px; border-radius: 10px; border: 1px solid var(--line);
    background: var(--panel); color: var(--text); font-size: 1rem; min-width: 0;
  }
  input[type=url]:focus { outline: none; border-color: var(--accent); }
  button {
    padding: 13px 20px; border-radius: 10px; border: 0; background: var(--accent);
    color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; white-space: nowrap;
  }
  button:disabled { opacity: .55; cursor: default; }
  .hint { color: var(--muted); font-size: .85rem; margin: 0 0 26px; }
  #out { margin-top: 14px; }
  .card { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 20px; }
  .meta { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .meta h2 { margin: 0; font-size: 1.05rem; }
  .meta .sub { color: var(--muted); font-size: .9rem; }
  .actions { display: flex; gap: 8px; margin-left: auto; }
  .actions button { font-size: .85rem; padding: 7px 13px; background: transparent; border: 1px solid var(--line); color: var(--text); }
  .actions button:hover { border-color: var(--accent); color: var(--accent); }
  pre.gen {
    margin: 0; padding: 16px; border-radius: 10px; background: #0c121c; border: 1px solid var(--line);
    overflow-x: auto; max-height: 460px; overflow-y: auto; font-size: .85rem; line-height: 1.5;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; color: #cdd9ea;
  }
  .warn { margin: 0 0 14px; padding: 10px 13px; border-radius: 10px; font-size: .88rem; color: #e9d39b; background: rgba(214,178,84,.12); border: 1px solid rgba(214,178,84,.3); }
  .err { color: #f2b6b1; }
  .spin { color: var(--muted); }
  footer { margin-top: 34px; color: var(--muted); font-size: .85rem; text-align: center; }
  footer a { color: var(--accent); text-decoration: none; }
  @media (max-width: 620px) { form { flex-direction: column; } .actions { margin-left: 0; } }
</style>
</head>
<body>
<div class="wrap">
  <nav class="lang" aria-label="Language">
    <a href="/en"${lang === 'en' ? ' class="on"' : ''}>EN</a>
    <a href="/it"${lang === 'it' ? ' class="on"' : ''}>IT</a>
  </nav>
  <header>
    <h1>${t.h1}</h1>
    <p>${t.lead}</p>
  </header>

  <div class="promo">
    <div class="txt">${t.promo}</div>
    <div class="promo-actions">
      <a class="promo-cta" href="https://trygeosuite.it" target="_blank" rel="noopener">${t.cta}</a>
      <a class="gh" href="https://github.com/TryGeoSuite/llms-txt-generator" target="_blank" rel="noopener">${t.star}</a>
    </div>
  </div>

  <form id="f">
    <input id="u" type="url" inputmode="url" placeholder="${t.placeholder}" autocomplete="off" autofocus>
    <button id="go" type="submit">${t.generate}</button>
  </form>
  <p class="hint">${t.hint}</p>

  <div id="out"></div>

  <footer>
    ${t.footer}
  </footer>
</div>

<script>var I18N = ${JSON.stringify(t.js)};</script>
<script>
  var out = document.getElementById('out');
  var input = document.getElementById('u');
  var btn = document.getElementById('go');
  var lastText = '';

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

  function render(r){
    if (r.error){
      out.innerHTML = '<div class="card err">' + esc(r.error) + '</div>';
      return;
    }
    lastText = r.llmstxt || '';
    var warn = r.truncated
      ? '<div class="warn">' + I18N.truncatedPre + r.count + I18N.truncatedMid + r.total + I18N.truncatedPost + '</div>'
      : '';
    out.innerHTML =
      warn +
      '<div class="card">' +
        '<div class="meta">' +
          '<h2>' + I18N.forValue + esc(r.site) + '</h2>' +
          '<span class="sub">' + r.count + I18N.pages + (r.isIndex ? I18N.sitemapIndex : '') + '</span>' +
          '<span class="actions">' +
            '<button id="copy" type="button">' + I18N.copy + '</button>' +
            '<button id="dl" type="button">' + I18N.download + '</button>' +
          '</span>' +
        '</div>' +
        '<pre class="gen">' + esc(lastText) + '</pre>' +
      '</div>';

    document.getElementById('copy').addEventListener('click', function(){
      navigator.clipboard.writeText(lastText).then(function(){
        var b = document.getElementById('copy'); b.textContent = I18N.copied;
        setTimeout(function(){ b.textContent = I18N.copy; }, 1500);
      });
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
    out.innerHTML = '<div class="card spin">' + I18N.reading + esc(url) + I18N.readingSuffix + '</div>';
    fetch('/api/generate?url=' + encodeURIComponent(url))
      .then(function(res){ return res.json(); })
      .then(function(r){ render(r); })
      .catch(function(){ out.innerHTML = '<div class="card err">' + I18N.networkError + '</div>'; })
      .finally(function(){ btn.disabled = false; });
  }

  document.getElementById('f').addEventListener('submit', function(e){
    e.preventDefault();
    var url = input.value.trim();
    if (url){ history.replaceState(null, '', '?url=' + encodeURIComponent(url)); run(url); }
  });

  var shared = new URLSearchParams(location.search).get('url');
  if (shared){ input.value = shared; run(shared); }
</script>
</body>
</html>`;
}
