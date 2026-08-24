// Slidecard templates: the /talks index, one deck page, and the glyph tile
// behind /deck/pattern.svg.
//
// Reading is the primary mode (design D1). Everything a deck says is in the
// server HTML, in document order, with no client JavaScript involved; the
// player in /talks/deck.js is an enhancement layered on top of markup that is
// already a readable page. test/talks-render.test.mjs pins that.
//
// The page shell comes from layout(), which owns <head>. layout() takes no
// head slot and this module does not own it, so the deck's stylesheets, font
// links and player <script> are emitted at the top of the body instead. Every
// engine honours them there; the alternative was widening layout()'s contract
// for one page.
//
// The pattern tile lives here rather than in routes/talks.js because
// routes/talks.js imports the registry, which imports the deck sources through
// the wrangler `Text` rule and therefore only resolves inside the Worker
// bundle. Query parameters are reflected into the response body — the one
// hostile-input surface in this design (§9.1) — so the code that validates
// them has to be reachable from a plain `node --test` run.

import { escapeHtml, formatDate, isoDate } from "../format.js";
import { layout } from "./layout.js";
import { DECK_CSS } from "./deck-css.js";

const e = escapeHtml;

// --- /talks -------------------------------------------------------------------

/**
 * The deck index. Order is the caller's: registry.listDecks() already sorts
 * newest first, and re-sorting here would put the ordering rule in two places.
 *
 * @param {{ slug: string, meta: object }[]} decks
 */
export function renderTalksIndex(decks) {
  const body = decks.length ? deckList(decks) : emptyState();
  return layout({
    title: "Talks — Ryan Schumacher",
    description: "Talks and slide decks by Ryan Schumacher.",
    current: "talks",
    body: `<h1 class="page-title">Talks</h1>
<p class="page-lede">Decks I have given, written as pages first. Each one reads top to bottom; press the arrow keys to fly it instead.</p>
${body}`,
  });
}

function deckList(decks) {
  const items = decks
    .map(({ slug, meta }) => {
      const meta_ = [dateLine(meta.date), venueLine(meta.venue)]
        .filter(Boolean)
        .join(" · ");
      return `<li>
      <h2 class="post-title"><a href="/talks/${encodeURIComponent(slug)}">${e(meta.title)}</a></h2>
      ${meta_ ? `<p class="post-meta">${meta_}</p>` : ""}
      ${meta.summary ? `<p class="post-summary">${e(meta.summary)}</p>` : ""}
    </li>`;
    })
    .join("");
  return `<ul class="postlist">${items}</ul>`;
}

/** A <time> when the date is a real YYYY-MM-DD, the raw string otherwise. */
function dateLine(raw) {
  if (!raw) return "";
  const human = formatDate(raw);
  if (!human) return e(raw);
  return `<time datetime="${e(isoDate(raw))}">${e(human)}</time>`;
}

function venueLine(venue) {
  return venue ? `<span class="venue">${e(venue)}</span>` : "";
}

function emptyState() {
  return `<div class="empty">
    <p>No talks published yet.</p>
    <p>They will appear here as they are given.</p>
  </div>`;
}

// --- /talks/<slug> ------------------------------------------------------------

/**
 * One deck page.
 *
 * The <h1> is not decoration: renderMarkdown shifts `#` down to `<h2>`
 * ("the page already owns the h1", §7.1), so without it every deck ships a
 * document outline that starts at level two.
 *
 * @param {{ slug: string, meta: object, theme: string|null, slides: object[] }} deck
 */
export function renderDeckPage(deck) {
  const { meta, theme, slides } = deck;
  // Stylesheets and font links belong in <head>: emitted in <body> they cause a
  // flash of the site's light theme before a dark deck paints, which on a
  // projector is exactly the wrong first impression.
  const head = [
    fontLinks(meta.fonts),
    `<style>${escapeStyle(DECK_CSS)}</style>`,
    theme ? `<style>${escapeStyle(theme)}</style>` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sub = [dateLine(meta.date), venueLine(meta.venue)].filter(Boolean).join(" · ");

  return layout({
    title: `${meta.title} — Ryan Schumacher`,
    description: meta.summary || undefined,
    current: "talks",
    head,
    body: `<header class="deck-intro">
  <h1 class="page-title">${e(meta.title)}</h1>
  ${sub ? `<p class="post-meta">${sub}</p>` : ""}
  ${meta.summary ? `<p class="page-lede">${e(meta.summary)}</p>` : ""}
</header>
${renderDeck(slides)}
<script type="module" src="/talks/deck.js" defer></script>`,
  });
}

/**
 * The deck itself. This markup is a contract with src/render/deck-css.js and
 * public/talks/deck.js — class names and `data-pos` are load-bearing.
 *
 * @param {{ pos: number[], kicker: string|null, id: string|null, html: string }[]} slides
 */
export function renderDeck(slides) {
  const items = slides.map(slideItem).join("\n");
  return `<article class="deck" data-deck>
<div class="deck-backdrop"></div>
<ol class="slides">
${items}
</ol>
</article>`;
}

function slideItem(slide, i) {
  const id = slide.id || `s${i + 1}`;
  const [x, y] = slide.pos;
  const kicker = slide.kicker ? `<span class="kicker">${e(slide.kicker)}</span>` : "";
  return `<li class="slide" id="${e(id)}" data-pos="${e(`${x},${y}`)}"><div class="slide-card">${kicker}<div class="slide-body">${slide.html}</div></div></li>`;
}

/**
 * Google Fonts, opt-in per deck (D6). Nothing is emitted when a deck declares
 * no fonts, which is what keeps a default deck at zero external requests.
 */
function fontLinks(fonts) {
  const families = (fonts ?? []).map(encodeFamily).filter(Boolean);
  if (!families.length) return "";
  const href = `https://fonts.googleapis.com/css2?${families
    .map((f) => `family=${f}`)
    .join("&")}&display=swap`;
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${e(href)}">`;
}

// `+ : ; @ , . _ -` are all legal in a query value and each one is meaningful
// to the css2 API (`+` is the space in a family name, `:` opens the axis list).
// Percent-encoding them would break the request; everything else is encoded.
function encodeFamily(family) {
  return String(family ?? "")
    .trim()
    .replace(/[^A-Za-z0-9+:;@,._-]/g, (c) => encodeURIComponent(c));
}

/** Second line of defence: the parser and the validator both reject `</style` too. */
function escapeStyle(css) {
  return String(css ?? "").replace(/<\/(style)/gi, "<\\/$1");
}

// --- /deck/pattern.svg --------------------------------------------------------

const SVG_HEADERS = {
  "content-type": "image/svg+xml; charset=utf-8",
  "cache-control": "public, max-age=31536000, immutable",
  "x-content-type-options": "nosniff",
};

const ERROR_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

// Deliberately no exponents and no leading `+`: "1e3" and "+48" are far more
// likely to be a mangled URL than an intent. Negatives parse and then clamp.
const INTEGER = /^-?\d+$/;
const NUMBER = /^-?\d*\.?\d+$/;
const HEX_COLOUR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// C0, DEL and C1. Rejected rather than escaped: a control character in a tile
// glyph is never intentional, and XML 1.0 cannot represent most of them anyway.
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;

const SIZE_MIN = 8;
const SIZE_MAX = 256;
const DEFAULT_SIZE = 48;
const DEFAULT_OPACITY = 0.06;
// Neutral grey reads as a faint darkening on light decks and a faint lightening
// on dark ones, so a deck that does not pass `color` still gets a usable tile.
const DEFAULT_COLOUR = "#808080";

class PatternError extends Error {}

/**
 * GET /deck/pattern.svg — a one-glyph tile, generated per request.
 *
 * Everything here is attacker-controlled. Out-of-range numbers are clamped
 * (a deck asking for size=1000 wants the biggest tile it can have), but
 * anything that is not a number, and any glyph that is missing, oversized or
 * contains a control character, is a 400 rather than a quietly-wrong SVG.
 *
 * @param {URL} url
 * @returns {Response}
 */
export function patternSvgResponse(url) {
  let svg;
  try {
    svg = patternSvg(url.searchParams);
  } catch (err) {
    if (err instanceof PatternError) {
      return new Response(`${err.message}\n`, { status: 400, headers: ERROR_HEADERS });
    }
    throw err;
  }
  return new Response(svg, { headers: SVG_HEADERS });
}

/**
 * The tile body.
 *
 * @param {URLSearchParams} params
 * @returns {string} SVG source
 * @throws {PatternError} on any input this route will not reflect
 */
export function patternSvg(params) {
  const glyph = readGlyph(params.get("g"));
  const size = readSize(params.get("size"));
  const opacity = readOpacity(params.get("opacity"));
  const colour = readColour(params.get("color"));

  const fontSize = Math.max(1, Math.round(size / 2));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${size} ${size}">` +
    `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="system-ui,-apple-system,'Segoe UI Emoji','Noto Color Emoji',sans-serif" ` +
    `font-size="${fontSize}" fill="${colour}" opacity="${opacity}">` +
    `${xml(glyph)}</text></svg>\n`
  );
}

function readGlyph(raw) {
  if (raw === null || raw === "") throw new PatternError("g is required");
  if (CONTROL.test(raw)) throw new PatternError("g contains a control character");
  // Code points, not UTF-16 units: one astral emoji is one glyph, not two.
  const points = Array.from(raw).length;
  if (points > 8) throw new PatternError("g must be 1-8 code points");
  return raw;
}

function readSize(raw) {
  if (raw === null || raw === "") return DEFAULT_SIZE;
  if (!INTEGER.test(raw.trim())) throw new PatternError("size must be an integer");
  return clamp(Number(raw), SIZE_MIN, SIZE_MAX);
}

function readOpacity(raw) {
  if (raw === null || raw === "") return DEFAULT_OPACITY;
  if (!NUMBER.test(raw.trim())) throw new PatternError("opacity must be a number");
  // Trailing-zero noise ("0.0600") would otherwise land in the response body.
  return Number(clamp(Number(raw), 0, 1).toFixed(4));
}

function readColour(raw) {
  if (raw === null || raw === "") return DEFAULT_COLOUR;
  if (!HEX_COLOUR.test(raw.trim())) throw new PatternError("color must be #rgb or #rrggbb");
  return raw.trim();
}

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}

/** XML text escaping. Quotes included: the glyph is one edit away from an attribute. */
function xml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
