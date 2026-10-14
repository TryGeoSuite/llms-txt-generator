// Copied from TryGeoSuite/geo-toolkit/theme.js (the hub at tools.trygeosuite.it)
// so this tool reads as part of the same site. Keep it in step with that file:
// change it there first, then copy it here unchanged (this header aside).
//
// The visual layer shared by the hub, the AI Readiness Check and the tools.
// It follows GeoSuite's design system (geo/design-system/geosuite/MASTER.md):
// Inter, flat surfaces with one-pixel lines, magenta only for the primary action
// and the visitor's own row, semantic colors always paired with text or an icon,
// light and dark both first-class. Token values are copied from
// frontend/assets/css/99-workspace-ds-sweep.css; keep them in step. The brand is
// text, like GeoSuite's own header: the official wordmark is white on
// transparent and must not be recolored for the light theme.

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

// Tokens, page chrome (bar, hero, footer) and the components both pages use:
// the URL form, panels, the ranked list, the GeoSuite call to action.
export const BASE_CSS = `
  :root {
    --bg:#f4f5f7; --surface:#fff; --surface-2:#f8f9fb; --sunk:#eef0f3;
    --ink:#111318; --ink-2:#424854; --ink-3:#596474;
    --line:#e5e7eb; --line-2:#d8dce2;
    --accent:#e0327d; --accent-deep:#b81862; --accent-soft:#fdeaf3; --accent-ink:#a3105a; --on-accent:#fff;
    --ok:#127348; --ok-soft:#e7f6ec; --warn:#875000; --warn-soft:#fbf1de; --crit:#bd2838; --crit-soft:#fdeaeb;
    --shadow:0 1px 2px rgba(17,19,24,.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#111318; --surface:#181b21; --surface-2:#20242c; --sunk:#0d0f13;
      --ink:#f5f7fa; --ink-2:#c5cad3; --ink-3:#979eaa;
      --line:#282d36; --line-2:#353c48;
      --accent:#f2529a; --accent-deep:#b81862; --accent-soft:#2a1420; --accent-ink:#f7a6cb;
      --ok:#39c877; --ok-soft:#12241a; --warn:#e0a53c; --warn-soft:#27200f; --crit:#f0666d; --crit-soft:#2a1416;
      --shadow:0 1px 2px rgba(0,0,0,.28);
    }
  }
  * { box-sizing:border-box; }
  html { -webkit-text-size-adjust:100%; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-font-smoothing:antialiased; }
  a { color:var(--accent-ink); }
  :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:4px; }
  .wrap { max-width:880px; margin:0 auto; padding:0 16px 64px; }

  .bar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 0; }
  .brand { color:var(--ink); text-decoration:none; font-size:19px; font-weight:700; letter-spacing:-.035em; }
  .bar nav { display:flex; align-items:center; gap:4px; font-size:.875rem; }
  .bar nav a { color:var(--ink-3); text-decoration:none; padding:6px 10px; border-radius:8px; min-height:32px; display:inline-flex; align-items:center; }
  .bar nav a:hover { color:var(--ink); background:var(--sunk); }
  .bar nav a[aria-current="page"] { color:var(--ink); background:var(--surface); box-shadow:inset 0 0 0 1px var(--line); }

  .hero { display:grid; grid-template-columns:1fr; gap:32px; padding:40px 0 8px; align-items:start; }
  @media (min-width:900px) { .wrap { max-width:1080px; } .hero { grid-template-columns:1.15fr 1fr; gap:48px; } }
  .eyebrow { display:inline-block; font-size:.8125rem; font-weight:600; color:var(--accent-ink); background:var(--accent-soft); padding:4px 10px; border-radius:999px; margin:0 0 16px; }
  h1 { font-size:clamp(2rem, 4.6vw, 3rem); line-height:1.08; letter-spacing:-.03em; margin:0 0 14px; text-wrap:balance; }
  .lead { color:var(--ink-2); font-size:1.125rem; margin:0 0 24px; max-width:48ch; }
  .urlform { display:flex; gap:8px; }
  .urlform label { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  input { flex:1; min-width:0; height:52px; background:var(--surface); border:1px solid var(--line-2); color:var(--ink); border-radius:8px; padding:0 16px; font:inherit; font-size:1.0625rem; }
  input::placeholder { color:var(--ink-3); }
  button { font:inherit; cursor:pointer; }
  .primary { height:52px; padding:0 22px; border:0; border-radius:8px; background:var(--accent-deep); color:var(--on-accent); font-weight:600; white-space:nowrap; min-width:150px; }
  .primary:hover { background:#9a1352; }
  .primary[disabled] { opacity:.65; cursor:progress; }
  .facts { display:flex; flex-wrap:wrap; gap:6px 16px; list-style:none; margin:14px 0 0; padding:0; color:var(--ink-3); font-size:.875rem; }
  .facts li { display:flex; align-items:center; gap:6px; }
  .facts strong { color:var(--ink-2); font-weight:600; font-variant-numeric:tabular-nums; }
  .facts svg { width:14px; height:14px; } .facts svg circle { fill:var(--ok); } .facts svg path { stroke:#fff; }
  .err { color:var(--crit); margin:12px 0 0; min-height:1.5em; font-size:.9375rem; }

  .panel, .example { background:var(--surface); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); }
  .label { font-size:.75rem; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-3); margin:0; }
  .q { font-size:1.0625rem; font-weight:500; color:var(--ink); margin:12px 0 16px; padding-left:14px; border-left:3px solid var(--line-2); }

  .example { padding:20px; margin:0; }
  .example figcaption { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
  .ex-meta { color:var(--ink-3); font-size:.8125rem; }
  .ex-verdict { display:flex; gap:8px; align-items:center; font-weight:600; margin:0 0 12px; }
  .ex-verdict svg { width:18px; height:18px; flex:none; } .ex-verdict svg circle { fill:var(--ok); } .ex-verdict svg path { stroke:#fff; }
  .example[hidden], section[hidden], div[hidden] { display:none; }

  ol.recs { list-style:none; margin:0; padding:0; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  ol.recs li { display:grid; grid-template-columns:28px 1fr auto; align-items:start; gap:12px; padding:12px 14px; border-top:1px solid var(--line); }
  ol.recs li:first-child { border-top:0; }
  ol.recs .n { font-variant-numeric:tabular-nums; font-weight:600; color:var(--ink-3); text-align:center; line-height:1.5; }
  ol.recs .name { font-weight:600; min-width:0; overflow-wrap:anywhere; }
  ol.recs li.you { background:var(--accent-soft); }
  ol.recs li.you .n, ol.recs li.you .name { color:var(--accent-ink); }
  ol.recs.compact li { grid-template-columns:28px 1fr; padding:10px 12px; }
  .tag { display:inline-block; margin-left:6px; padding:1px 8px; border-radius:999px; background:var(--accent-deep); color:var(--on-accent); font-size:.75rem; font-weight:600; vertical-align:2px; }

  .cta { margin-top:16px; padding:28px; display:grid; grid-template-columns:1fr auto; gap:24px; align-items:center; }
  .cta h2 { font-size:1.375rem; line-height:1.25; margin:0 0 8px; letter-spacing:-.015em; }
  .cta p { color:var(--ink-2); margin:0; max-width:58ch; }
  .engines { display:flex; align-items:center; gap:14px; margin-top:16px; color:var(--ink-3); font-size:.8125rem; flex-wrap:wrap; }
  .engines span { display:inline-flex; align-items:center; gap:6px; color:var(--ink-2); font-weight:500; }
  .engines img { width:20px; height:20px; display:block; }
  .cta a.primary { display:inline-flex; align-items:center; text-decoration:none; }
  .ghost { background:none; border:1px solid var(--line-2); color:var(--ink-2); border-radius:8px; padding:8px 12px; font-size:.875rem; min-height:36px; }
  .ghost:hover { color:var(--ink); border-color:var(--ink-3); }

  footer { margin-top:48px; padding-top:20px; border-top:1px solid var(--line); color:var(--ink-3); font-size:.8125rem; }
  footer a { color:var(--ink-2); }

  @media (max-width:640px) {
    .hero { padding-top:20px; }
    .urlform { flex-direction:column; }
    .urlform input { flex:none; width:100%; }
    .primary { width:100%; }
    .cta { grid-template-columns:1fr; padding:20px; }
    .cta a.primary { justify-content:center; }
  }
`;

// The three engines GeoSuite's analysis asks, served by the worker at /logos/.
export const ENGINES = `<div class="engines" aria-hidden="true">
          <span><img src="/logos/chatgpt.svg" alt="">ChatGPT</span>
          <span><img src="/logos/gemini.svg" alt="">Gemini</span>
          <span><img src="/logos/perplexity.svg" alt="">Perplexity</span>
        </div>`;
