// The site stylesheet.
//
// RESUME_CSS below is the canonical résumé stylesheet ported from
// jrschumacher/resume (src/render/css.js), unchanged in its résumé rules. The
// site layer (nav, footer, blog, small-screen) is appended in the same idiom —
// same variables, same two families, same rule-under-a-section-title motif —
// rather than introducing a second visual language. A dedicated design pass
// comes later; this is the conservative baseline it will start from.

const RESUME_CSS = `
:root {
  --ink: #1a1a1a;
  --muted: #555;
  --rule: #d9d9d9;
  --accent: #14507a;
  --max: 8.5in;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  color: var(--ink);
  background: #f4f4f5;
  font: 11pt/1.42 "Georgia", "Times New Roman", serif;
}
.page {
  max-width: var(--max);
  margin: 0.4in auto;
  padding: 0.55in 0.6in;
  background: #fff;
  box-shadow: 0 1px 6px rgba(0,0,0,.12);
}
header.masthead { text-align: center; margin-bottom: 14px; }
h1.name {
  margin: 0;
  font-size: 23pt;
  letter-spacing: .5px;
  font-weight: 700;
}
.headline {
  margin: 3px 0 6px;
  font-size: 11.5pt;
  font-style: italic;
  color: var(--accent);
}
.contact {
  font-size: 9.5pt;
  color: var(--muted);
  font-family: "Helvetica Neue", Arial, sans-serif;
}
.contact a { color: inherit; text-decoration: none; }
.summary {
  margin: 10px 0 4px;
  text-align: justify;
  hyphens: auto;
}
section { margin-top: 14px; }
h2.section-title {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5pt;
  text-transform: uppercase;
  letter-spacing: 1.4px;
  color: var(--accent);
  border-bottom: 1.5px solid var(--accent);
  padding-bottom: 2px;
  margin: 0 0 7px;
}
ul { margin: 4px 0 0; padding-left: 18px; }
li { margin: 3px 0; }
.role { margin-top: 9px; }
.role:first-child { margin-top: 4px; }
.company-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-family: "Helvetica Neue", Arial, sans-serif;
}
.company-name { font-weight: 700; font-size: 11.5pt; }
.company-loc { color: var(--muted); font-size: 9.5pt; white-space: nowrap; }
.role-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5pt;
}
.role-title { font-weight: 600; }
.role-note { font-weight: 400; font-style: italic; color: var(--muted); }
.role-dates { color: var(--muted); font-size: 9.5pt; white-space: nowrap; }
.skills-row { margin: 3px 0; }
.skills-row .cat {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-weight: 600;
}
.education-row { display: flex; justify-content: space-between; gap: 12px; }
.education-row .degree { color: var(--muted); }

@media print {
  body { background: #fff; }
  /* Let @page own the margins so they repeat on every page; no padding here
     or it would double up on page 1 and leave page 2+ hugging the edge. */
  .page { margin: 0; box-shadow: none; max-width: none; padding: 0; }
  /* Keep a single role together, but DON'T avoid breaks inside whole sections
     (Experience is taller than a page — avoiding a break there strands it to
     the next page and leaves the first page half empty). */
  .role { break-inside: avoid; }
  .company-line { break-after: avoid; }   /* no company name orphaned at a page foot */
  h2.section-title { break-after: avoid; } /* keep a section header with its first content */
  a { color: inherit; }
}
@page { size: Letter; margin: 0.5in 0.6in; }
`;

// --- Site chrome + blog, in the same idiom -----------------------------------

const SITE_CSS = `
a { color: var(--accent); }
a:focus-visible,
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.sitenav {
  max-width: var(--max);
  margin: 0.4in auto -0.25in;
  padding: 0 0.6in;
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 10pt;
  display: flex;
  gap: 18px;
  align-items: baseline;
}
.sitenav a { color: var(--muted); text-decoration: none; }
.sitenav a:hover { color: var(--accent); text-decoration: underline; }
.sitenav a[aria-current="page"] { color: var(--ink); font-weight: 600; }

.sitefoot {
  max-width: var(--max);
  margin: 0 auto 0.5in;
  padding: 0 0.6in;
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 9.5pt;
  color: var(--muted);
}
.sitefoot a { color: var(--muted); }

/* Blog index */
.page-title {
  margin: 0 0 4px;
  font-size: 20pt;
  font-weight: 700;
  letter-spacing: .3px;
}
.page-lede { margin: 0 0 18px; color: var(--muted); }

.postlist { list-style: none; margin: 0; padding: 0; }
.postlist > li {
  margin: 0;
  padding: 14px 0;
  border-top: 1px solid var(--rule);
}
.postlist > li:first-child { border-top: none; padding-top: 0; }
.post-title { margin: 0 0 2px; font-size: 13pt; font-weight: 700; }
.post-title a { text-decoration: none; }
.post-title a:hover { text-decoration: underline; }
.post-meta {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 9.5pt;
  color: var(--muted);
}
.post-meta > * + *::before { content: " · "; }
.post-summary { margin: 5px 0 0; }

.badge {
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 8.5pt;
  letter-spacing: .6px;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 0 4px;
}

.empty {
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  padding: 28px 0;
  color: var(--muted);
  text-align: center;
}
.empty p { margin: 0; }
.empty p + p { margin-top: 6px; }

/* Blog post */
.post-header { margin-bottom: 16px; }
.post-header .page-title { margin-bottom: 6px; }
.post-deck { margin: 6px 0 8px; font-size: 12pt; color: var(--muted); }

.prose { max-width: 34em; }
.prose h2, .prose h3, .prose h4 {
  font-family: "Helvetica Neue", Arial, sans-serif;
  line-height: 1.3;
  margin: 22px 0 6px;
}
.prose h2 { font-size: 13pt; }
.prose h3 { font-size: 11.5pt; }
.prose h4 { font-size: 11pt; color: var(--muted); }
.prose p { margin: 0 0 12px; }
.prose ul, .prose ol { margin: 0 0 12px; padding-left: 22px; }
.prose li { margin: 4px 0; }
.prose blockquote {
  margin: 0 0 12px;
  padding-left: 14px;
  border-left: 3px solid var(--rule);
  color: var(--muted);
}
.prose hr { border: 0; border-top: 1px solid var(--rule); margin: 22px 0; }
.prose img { max-width: 100%; height: auto; }
.prose code {
  font-family: "SFMono-Regular", Menlo, Consolas, monospace;
  font-size: .88em;
  background: #f2f2f3;
  padding: .1em .3em;
}
.prose pre {
  background: #f2f2f3;
  border: 1px solid var(--rule);
  padding: 10px 12px;
  overflow-x: auto;
  margin: 0 0 12px;
}
.prose pre code { background: none; padding: 0; font-size: .85em; }
.prose table { border-collapse: collapse; margin: 0 0 12px; }
.prose th, .prose td { border: 1px solid var(--rule); padding: 4px 8px; text-align: left; }

.revisions { margin-top: 26px; }
.revisions ol { list-style: none; margin: 0; padding: 0; }
.revisions li { margin: 0; padding: 8px 0; border-top: 1px solid var(--rule); }
.revisions li:first-child { border-top: none; }
.revisions .when {
  display: block;
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 9pt;
  color: var(--muted);
}
.living-note { color: var(--muted); font-size: 10pt; margin: 8px 0 0; }

.backlink {
  margin-top: 26px;
  font-family: "Helvetica Neue", Arial, sans-serif;
  font-size: 10pt;
}

/* Small screens — the résumé geometry is inches; below tablet it has to give. */
@media (max-width: 40em) {
  body { font-size: 12px; }
  .page { margin: 0; padding: 22px 18px; box-shadow: none; }
  .sitenav { margin: 0; padding: 14px 18px 0; }
  .sitefoot { margin: 0 0 24px; padding: 0 18px; }
  h1.name { font-size: 21pt; }
  .company-line, .role-line, .education-row {
    display: block;
  }
  .company-loc, .role-dates, .education-row .degree { display: block; }
  .summary { text-align: left; }
}

@media print {
  .sitenav, .sitefoot, .backlink { display: none; }
}
`;

export const SITE_STYLESHEET = RESUME_CSS + SITE_CSS;
export { RESUME_CSS };
