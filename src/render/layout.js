// The one page shell. Every HTML response goes through here, so the nav, the
// stylesheet and the <head> exist in exactly one place. No client JS: there is
// nothing on this site that needs it.

import { escapeHtml } from "../format.js";
import { SITE_STYLESHEET } from "./css.js";

const e = escapeHtml;

const NAV = [
  { href: "/", label: "Résumé", key: "resume" },
  { href: "/blog", label: "Blog", key: "blog" },
  { href: "/resume.txt", label: "Plain text", key: "text" },
];

function nav(current) {
  const items = NAV.map((item) => {
    const here = item.key === current ? ' aria-current="page"' : "";
    return `<a href="${item.href}"${here}>${e(item.label)}</a>`;
  }).join("");
  return `<nav class="sitenav" aria-label="Site">${items}</nav>`;
}

/**
 * @param {object} opts
 * @param {string} opts.title        <title> text (already plain, escaped here)
 * @param {string} [opts.description] meta description
 * @param {string} [opts.current]    nav key to mark as current
 * @param {string} opts.body         markup for the <main class="page"> element
 */
export function layout({ title, description, current, body }) {
  const desc = description
    ? `<meta name="description" content="${e(description)}">`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
${desc}
<style>${SITE_STYLESHEET}</style>
</head>
<body>
${nav(current)}
<main class="page">
${body}
</main>
<footer class="sitefoot">
  <p>Ryan Schumacher · <a href="https://github.com/jrschumacher">github.com/jrschumacher</a></p>
</footer>
</body>
</html>`;
}
