// The Slidecard deck stylesheet.
//
// Two modes, one DOM. Without JavaScript a deck is an ordinary vertical
// document: every slide readable, in document order. The player is a
// progressive enhancement, and *every* rule it needs is scoped under
// `.deck--player`, a class `public/talks/deck.js` adds to the article.
//
// The camera geometry in the player block is an invariant, not a tuning
// value (spec 8.1): cell spacing must be at least viewport + card, or both
// neighbours are visible mid-flight on a wide screen. Because `--card-w` is
// one declaration feeding both the card and the spacing, S >= V + C holds
// at every viewport size by construction -- including now that the card is
// sized as a share of the viewport, min(92dvw, 156dvh), rather than capped
// at a fixed pixel width, which left a sea of backdrop on a large display.
// 156dvh keeps the card 16:9 with a bottom margin the keycap bar lives in.
//
// The script's only job is `--cam-x` / `--cam-y` on the plane and
// `--x` / `--y` per slide. All geometry lives here.
//
// Theme tokens a deck may override on `.deck`:
//   --card    card background       --ink     body text
//   --accent  kickers, rules, links --serif   headings and prose
//   --mono    code and chrome
// and on `.deck-backdrop` / `.deck-backdrop::before`:
//   background / background-image, --wallpaper-angle, --wallpaper-drift,
//   --wallpaper-tile
// A deck with no theme block still looks deliberate: it inherits the site's
// ink, accent and families.

export const DECK_CSS = `
/* ------------------------------------------------------------------ *
 * Tokens. Defaults match src/render/css.js so an unthemed deck reads
 * as part of the site rather than as an unstyled fragment.
 * ------------------------------------------------------------------ */
.deck {
  --card: #ffffff;
  --ink: #1a1a1a;
  --muted: #55555f;
  --accent: #14507a;
  --rule: #d9d9d9;
  --deck-bg: #f4f4f5;
  --serif: "Georgia", "Times New Roman", serif;
  --mono: "SFMono-Regular", Menlo, Consolas, monospace;

  --card-radius: .1em;
  /* Type is a share of the card, not of the viewport, so a slide is the same
     slide at every size. --type-scale is the body ratio; the heading lands at
     --type-scale * --h2 of card width. Measures are in ch, which scales with
     the type, so the line length is fixed in characters at any card size.

     All four were swept against every slide of a real 22-slide deck rather
     than reasoned out, because type scale and measure trade against each
     other: a tighter measure wraps more lines, which costs the height a
     larger type needs. At .019/54ch the four densest slides overflowed the
     card. At .0175/72ch nothing overflows, the densest slide sits at 91% of
     the body box, the text column fills 85% of the card's content width,
     the heading lands at 5.1% of card width and body text at 1.75%.
     Tightening the measure to 66ch pushes the densest slide back to 96%,
     which is no headroom for the next deck. */
  /* Reading mode is the primary mode (D1), so the plain tokens carry its
     document values and the player re-points them at the --*-slide pair
     below. Both halves stay themeable: a deck sets --h2 to retune the
     document heading and --h2-slide to retune the projector heading. A
     single shared value cannot serve both, because the em root differs by
     more than 2x between the modes -- 2.9em of a projector card is a
     display heading, 2.9em of a reading column is three lines of shouting. */
  --h2: 1.75em;
  --measure: none;
  --measure-h2: none;

  --type-scale: .0175;
  --h2-slide: 2.9em;
  --measure-slide: 72ch;
  --measure-h2-slide: 20ch;
  --card-shadow: 0 1px 3px rgba(0,0,0,.10), 0 14px 38px rgba(0,0,0,.10);
  --fly: 600ms;
  --ease: cubic-bezier(.32,.72,.24,1);

  position: relative;
  isolation: isolate;
  margin: 0;
  color: var(--ink);
  font-family: var(--serif);
}

/* The card is sized from --card-w, which also sets cell spacing (8.1). It
   must not grow by its own padding, so the deck owns its box model rather
   than inheriting the site's global reset. */
.deck, .deck *, .deck *::before, .deck *::after { box-sizing: border-box; }

/* ------------------------------------------------------------------ *
 * Backdrop. In reading mode it sits behind the article only, so it can
 * never paint over site chrome; in the player the article is the
 * viewport, so the same rule fills the screen.
 * ------------------------------------------------------------------ */
.deck-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--deck-bg);
}

/* Oversized so a rotated tile layer shows no bald corners: 250% of each
   axis covers any --wallpaper-angle plus a full tile of drift. Drift
   animates transform, never background-position. */
.deck-backdrop::before {
  content: "";
  position: absolute;
  inset: -75%;
  background-image: none;
  background-repeat: repeat;
  transform: rotate(var(--wallpaper-angle, 0deg));
  transform-origin: 50% 50%;
  animation: deck-drift var(--wallpaper-drift, 0s) linear infinite;
  will-change: transform;
}

@keyframes deck-drift {
  from { transform: rotate(var(--wallpaper-angle, 0deg)) translate3d(0, 0, 0); }
  to {
    transform: rotate(var(--wallpaper-angle, 0deg))
               translate3d(var(--wallpaper-tile, 96px), var(--wallpaper-tile, 96px), 0);
  }
}

/* ------------------------------------------------------------------ *
 * Reading mode (the default). A column of cards, in document order.
 * ------------------------------------------------------------------ */
.deck .slides {
  position: relative;
  z-index: 1;
  list-style: none;
  margin: 0 auto;
  padding: clamp(1.5rem, 5vw, 4rem) clamp(1rem, 5vw, 3rem);
  max-inline-size: 48rem;
  display: grid;
  gap: clamp(1.5rem, 4vw, 3rem);
}

.deck .slide { margin: 0; }

.slide-card {
  background: var(--card);
  border: max(1px, .03em) solid var(--rule);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  padding: 2em 2.4em;
  /* The one length inside the card that is deliberately NOT em: this is the
     root of the card's em cascade. Reading mode tracks the reading column;
     the player overrides it with a fraction of --card-w. Everything else
     inside the card is em off this, so a slide is identical at every
     viewport size -- just bigger. */
  font-size: clamp(1rem, .94rem + .35vw, 1.15rem);
  line-height: 1.45;
}

.kicker {
  display: block;
  margin: 0 0 1.4em;
  font-family: var(--mono);
  font-size: .7em;
  font-weight: 500;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--accent);
}
.kicker::before {
  content: "";
  display: inline-block;
  inline-size: 2.2em;
  vertical-align: .3em;
  margin-inline-end: .8em;
  border-block-start: .14em solid currentColor;
}

/* ------------------------------------------------------------------ *
 * Slide typography. Every length here is em off the card's own font-size,
 * so one set of rules serves a ~1.05rem reading column and a projector card
 * whose type is a fraction of --card-w. Growing the card does not re-flow a
 * slide, it enlarges it: the same words break on the same lines at 1280x720
 * and at 2560x1440.
 * ------------------------------------------------------------------ */
.slide-body > :first-child { margin-block-start: 0; }
.slide-body > :last-child { margin-block-end: 0; }

.slide-body h2 {
  margin: 0 0 .5em;
  max-inline-size: var(--measure-h2);
  font-family: var(--serif);
  font-size: var(--h2);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -.012em;
  text-wrap: balance;
}
.slide-body h3 {
  margin: 1.2em 0 .4em;
  font-size: 1.3em;
  line-height: 1.2;
  text-wrap: balance;
}
.slide-body h4 {
  margin: 1.2em 0 .4em;
  font-family: var(--mono);
  font-size: .82em;
  font-weight: 500;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted);
}
.slide-body p { margin: 0 0 .75em; text-wrap: pretty; }
.slide-body ul, .slide-body ol { margin: 0 0 .75em; padding-inline-start: 1.3em; }
/* Without this the body runs the full width of a very wide card, which is a
   100-character line. Tables, code and figures are exempt: they are meant to
   span. */
.slide-body > p,
.slide-body > ul,
.slide-body > ol,
.slide-body > blockquote,
.slide-body > h3,
.slide-body > h4 { max-inline-size: var(--measure); }
.slide-body li { margin-block-end: .35em; }
.slide-body li::marker { color: var(--accent); }
.slide-body a { color: var(--accent); text-underline-offset: .18em; }
.slide-body strong { font-weight: 700; }
.slide-body blockquote {
  margin: 0 0 .75em;
  padding-inline-start: 1em;
  border-inline-start: .16em solid var(--accent);
  color: var(--muted);
  font-style: italic;
}
.slide-body code {
  font-family: var(--mono);
  font-size: .86em;
  background: color-mix(in srgb, var(--ink) 7%, transparent);
  padding: .1em .35em;
  border-radius: .2em;
}
.slide-body pre {
  margin: 0 0 .75em;
  padding: .8em 1em;
  overflow: auto;
  background: color-mix(in srgb, var(--ink) 7%, transparent);
  border-radius: .25em;
  font-size: .8em;
  line-height: 1.4;
}
.slide-body pre code { background: none; padding: 0; font-size: 1em; }
.slide-body img, .slide-body svg, .slide-body video {
  max-inline-size: 100%;
  block-size: auto;
  border-radius: .12em;
}
.slide-body hr {
  border: 0;
  border-block-start: max(1px, .05em) solid var(--rule);
  margin: 1.2em 0;
}
/* A table had no block margin at all while every sibling has one, so the
   sentence after a table butted against its last rule and read as one more
   row. More below than above: the bottom border already reads as a boundary,
   so the space has to clear the border before the next line starts. These
   are the table's own em, which is .9 of the body's -- 1.35/1.9 here is the
   1.2/1.7 of body text the siblings use. The '> :last-child' rule still
   zeroes the bottom margin when a table ends a slide. */
.slide-body table {
  inline-size: 100%;
  border-collapse: collapse;
  font-size: .9em;
  margin: 1.35em 0 1.9em;
}
.slide-body th, .slide-body td {
  text-align: start;
  padding: .3em .6em;
  border-block-end: max(1px, .04em) solid var(--rule);
}

/* ------------------------------------------------------------------ *
 * Player mode. Everything below is scoped to the class the script adds.
 * ------------------------------------------------------------------ */
.deck-presenting, .deck-presenting body {
  overflow: hidden;
  block-size: 100%;
}

.deck--player {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  overflow: hidden;
  background: var(--deck-bg);
  touch-action: none;
}
.deck--player:focus { outline: none; }
.deck--player:focus-visible { outline: none; }

/* The plane. One transform, two custom properties, no state machine. */
.deck--player .slides {
  --card-w: min(92dvw, 156dvh);
  --card-h: calc(var(--card-w) * 9 / 16);
  --step-x: calc(100dvw + var(--card-w) + 4vmin);
  --step-y: calc(100dvh + var(--card-h) + 4vmin);

  position: absolute;
  inset: 0;
  display: block;
  margin: 0;
  padding: 0;
  max-inline-size: none;
  transform: translate(calc(var(--cam-x, 0) * var(--step-x) * -1),
                       calc(var(--cam-y, 0) * var(--step-y) * -1));
  transition: transform var(--fly, 600ms) var(--ease);
  will-change: transform;
}

.deck--player .slide {
  position: absolute;
  left: calc(var(--x, 0) * var(--step-x));
  top: calc(var(--y, 0) * var(--step-y));
  inline-size: 100%;
  block-size: 100%;
  display: grid;
  place-items: center;
  content-visibility: auto;
  contain-intrinsic-size: auto 100dvw auto 100dvh;
}

.deck--player .slide-card {
  inline-size: var(--card-w);
  block-size: var(--card-h);
  --h2: var(--h2-slide);
  --measure: var(--measure-slide);
  --measure-h2: var(--measure-h2-slide);
  padding: 1.45em 2.5em;
  font-size: calc(var(--card-w) * var(--type-scale));
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 .05em .16em rgba(0,0,0,.12), 0 .8em 1.8em rgba(0,0,0,.22);
}
.deck--player .slide-body h2 { line-height: 1.08; }
.deck--player .kicker { flex: none; margin-block-end: 0; }
/* The kicker is pinned to the top of the card, so centring the body inside
   what is left of the card centres it low. This spacer mirrors the kicker
   band at the foot, which puts the content block in the optical middle of
   the whole card without letting a dense slide run under the kicker. */
.deck--player .slide-card::after {
  content: "";
  flex: none;
  block-size: 2em;
}
.deck--player .slide-body {
  flex: 1 1 auto;
  min-block-size: 0;
  display: flex;
  flex-direction: column;
  justify-content: safe center;
  overflow: hidden;
}

/* ------------------------------------------------------------------ *
 * Chrome: launch button, keycap hint bar, rotate veil.
 * ------------------------------------------------------------------ */
.deck-launch {
  position: fixed;
  inset-block-end: 1.2rem;
  inset-inline-end: 1.2rem;
  z-index: 5;
  display: inline-flex;
  align-items: center;
  gap: .5em;
  padding: .55em 1em;
  border: 1px solid var(--accent);
  border-radius: 3px;
  background: var(--card);
  color: var(--accent);
  font-family: var(--mono);
  font-size: .78rem;
  letter-spacing: .12em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 6px 18px rgba(0,0,0,.10);
}
.deck-launch:hover { background: var(--accent); color: var(--card); }
.deck--player .deck-launch { display: none; }

.deck-hint {
  position: absolute;
  z-index: 3;
  inset-inline: 0;
  inset-block-end: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: .4em 1.4em;
  padding: 1.4vmin 2vmin;
  color: var(--ink);
  font-family: var(--mono);
  font-size: clamp(10px, 1.15vmin, 13px);
  letter-spacing: .08em;
  pointer-events: none;
  opacity: .24;
  animation: deck-hint-settle 900ms 5s backwards;
}
.deck--player:hover .deck-hint { opacity: .8; animation: none; }
.deck-hint span { display: inline-flex; align-items: center; gap: .45em; }
.deck-hint kbd {
  font: inherit;
  min-inline-size: 1.9em;
  padding: .2em .45em;
  text-align: center;
  border: 1px solid currentColor;
  border-block-end-width: 2px;
  border-radius: 3px;
}
.deck-hint .deck-count { margin-inline-start: .4em; opacity: .8; }
@keyframes deck-hint-settle { from { opacity: .8; } to { opacity: .24; } }

/* Rotate veil: CSS-only, player-only. Any viewport taller than it is wide
   gets it -- there is no width gate, because a tall narrow window on a
   desktop is as unpresentable as a phone held upright. Reading mode is
   deliberately exempt: a deck must stay readable in portrait, which is the
   whole reading-primary design. */
@media (orientation: portrait) {
  .deck--player::after {
    content: var(--deck-rotate-label, "Rotate your device to present");
    position: absolute;
    inset: 0;
    z-index: 6;
    display: grid;
    place-items: center;
    padding: 12vw;
    text-align: center;
    /* --card and --ink are the one pair a theme is guaranteed to set
       together, so the veil stays legible on a dark deck. --deck-bg is not:
       a dark theme typically paints .deck-backdrop and leaves --deck-bg at
       the light default, which put cream text on a near-white veil. */
    background: var(--card);
    color: var(--ink);
    font-family: var(--mono);
    font-size: clamp(13px, 3.6vw, 18px);
    letter-spacing: .1em;
    text-transform: uppercase;
  }
}

/* ------------------------------------------------------------------ *
 * Reduced motion. The camera plus a drifting wallpaper at once is rough
 * for motion-sensitive readers, so both stop -- not just one.
 * ------------------------------------------------------------------ */
@media (prefers-reduced-motion: reduce) {
  .deck--player .slides { transition: none !important; }
  .deck-backdrop::before { animation: none !important; }
  .deck-hint { animation: none !important; opacity: .5; }
  .deck, .deck *, .deck::before, .deck::after,
  .deck-backdrop::before, .deck-launch {
    animation-duration: .001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .001ms !important;
    scroll-behavior: auto !important;
  }
}

/* ------------------------------------------------------------------ *
 * Print: reading layout, one slide per page, whichever mode is active.
 * ------------------------------------------------------------------ */
@media print {
  .deck-backdrop, .deck-hint, .deck-launch { display: none !important; }
  .deck--player::after,
  .deck--player .slide-card::after { content: none !important; }
  .deck--player {
    position: static !important;
    overflow: visible !important;
    background: none !important;
  }
  .deck--player .slides {
    position: static !important;
    display: block !important;
    transform: none !important;
    transition: none !important;
  }
  .deck--player .slide, .deck .slide {
    position: static !important;
    inline-size: auto !important;
    block-size: auto !important;
    display: block !important;
    content-visibility: visible !important;
    break-after: page;
    page-break-after: always;
  }
  .deck .slide:last-child { break-after: auto; page-break-after: auto; }
  .deck .slide-card {
    inline-size: auto !important;
    block-size: auto !important;
    font-size: 11pt !important;
    padding: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    background: none !important;
    overflow: visible !important;
  }
  .deck .slide-body { display: block !important; overflow: visible !important; }
}
`;
