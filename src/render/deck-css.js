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

     --type-scale was swept against every slide of a real 22-slide deck
     rather than reasoned out, because type scale and measure trade against
     each other: a tighter measure wraps more lines, which costs the height a
     larger type needs. At .019/54ch the four densest slides overflowed the
     card. At .0175/72ch nothing overflowed, and the densest slide sat at 91%
     of the body box.

     The measures are now "none" -- the cap is gone and the body fills the
     card. A capped column parked the content against one edge with a dead
     gutter beside it, and centring the column was no better. This does NOT
     put the sweep's invariant at risk: the sweep was guarding vertical
     overflow, and a wider measure wraps FEWER lines, so removing the cap
     moves the densest slide further below 91%, not above it. The number to
     watch when retuning is --type-scale, which is unchanged at .0175.

     What it does cost is line length: on a wide card the body is now a
     ~100-character measure, well past the 45-75 typographic norm. That is
     the accepted trade for filling the slide. A deck that disagrees sets
     --measure-slide itself. */
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
  --measure-slide: none;
  --measure-h2-slide: none;
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
/* The hook that caps prose to --measure. Both --measure-slide and
   --measure-h2-slide are now "none" (see the token block), so in stock decks
   this resolves to no cap and the body fills the card -- which is the
   intent: a capped column left the slide's content stacked against one edge
   with a dead gutter down the right, and centring it read no better.

   The rule is kept rather than deleted because --measure stays a themeable
   token: a deck that wants a tighter column sets --measure-slide and gets
   the cap back without touching this file. Tables, code and figures are
   deliberately outside the selector list either way -- they are meant to
   span.

   NOTE: no backticks below line 30. The whole stylesheet is a JS template
   literal, so a single backtick in a CSS comment ends the string and the
   module stops parsing. The // comments at the top of the file are outside
   it and may quote freely. */
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

/* Multi-column code compare (three or more code samples on one slide).
   The deck author has no wrapper element or class to reach for this --
   src/blog/markdown.js escapes raw HTML, so a three-sample slide always
   renders as flat siblings: <h2>, then a <p><strong>label</strong></p> +
   <pre> pair per sample, in document order. The layout is therefore
   selected structurally with :has(), never authored. Player-only: reading
   mode keeps the plain block flow above and stacks the pairs, which is
   the reasonable behaviour in a ~48rem document column (D2's own scoping
   rule already keeps every player-mode change out of reading mode).

   :has(> pre:nth-of-type(3)) matches "three or more" <pre> children, not
   exactly three -- a 4th sample falls through to CSS's normal grid
   auto-placement into an implicit 4th row rather than a 4th column, which
   is an acceptable degrade for a shape the deck does not currently use.
   The direct-child combinator keeps a <pre> nested inside a blockquote or
   list from ever counting.

   Placement is fully explicit (h2 spans the row; each label/code pair is
   pinned to its own column and row) rather than a bare
   repeat(3, 1fr) grid, because implicit auto-flow lays the seven
   children out left-to-right, top-to-bottom and interleaves the labels
   and code blocks across rows instead of pairing each label with the
   code beneath it. */
.deck--player .slide-body:has(> pre:nth-of-type(3)) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: auto auto minmax(0, 1fr);
  align-content: start;
  column-gap: 1.4em;
  row-gap: .35em;
}
.deck--player .slide-body:has(> pre:nth-of-type(2)):not(:has(> pre:nth-of-type(3))) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: auto auto minmax(0, 1fr);
  align-content: start;
  column-gap: 1.8em;
  row-gap: .35em;
}
/* h2 always spans the full row. Redundant while --measure-h2-slide is
   "none", but kept: a deck that re-caps the heading via that token would
   otherwise have it wrap against its own measure well before the grid
   track does. */
.deck--player .slide-body:has(> pre:nth-of-type(2)) > h2 {
  grid-column: 1 / -1;
  grid-row: 1;
  max-inline-size: none;
}
.deck--player .slide-body:has(> pre:nth-of-type(2)) > p,
.deck--player .slide-body:has(> pre:nth-of-type(2)) > pre {
  /* A grid item's automatic minimum width is its content's min-content --
     for a <pre> with no wrapping that is its longest line, which is wider
     than a 1/3 column for real code and would blow the 1fr tracks out to
     fit it instead of shrinking. This override is what lets the column
     win and the code scroll/shrink internally instead. */
  min-inline-size: 0;
  max-inline-size: none;
  margin: 0;
}
.deck--player .slide-body:has(> pre:nth-of-type(2)) > pre {
  min-block-size: 0;
  overflow: auto;
}
.deck--player .slide-body:has(> pre:nth-of-type(3)) > pre {
  /* Three columns leaves each sample roughly a third of the card's
     content width -- narrower than the .8em pre text this deck otherwise
     uses can fit without wrapping. Still an em off the card's own
     font-size (--type-scale * --card-w), the one root every slide length
     is required to track (spec 8.1) -- not a new absolute size. */
  font-size: .5em;
}
.deck--player .slide-body:has(> pre:nth-of-type(2)):not(:has(> pre:nth-of-type(3))) > pre {
  font-size: .68em;
}
.deck--player .slide-body:has(> pre:nth-of-type(3)) > p:nth-of-type(1),
.deck--player .slide-body:has(> pre:nth-of-type(2)):not(:has(> pre:nth-of-type(3))) > p:nth-of-type(1) {
  grid-column: 1;
  grid-row: 2;
}
.deck--player .slide-body:has(> pre:nth-of-type(3)) > p:nth-of-type(2),
.deck--player .slide-body:has(> pre:nth-of-type(2)):not(:has(> pre:nth-of-type(3))) > p:nth-of-type(2) {
  grid-column: 2;
  grid-row: 2;
}
.deck--player .slide-body:has(> pre:nth-of-type(3)) > p:nth-of-type(3) {
  grid-column: 3;
  grid-row: 2;
}
.deck--player .slide-body:has(> pre:nth-of-type(3)) > pre:nth-of-type(1),
.deck--player .slide-body:has(> pre:nth-of-type(2)):not(:has(> pre:nth-of-type(3))) > pre:nth-of-type(1) {
  grid-column: 1;
  grid-row: 3;
}
.deck--player .slide-body:has(> pre:nth-of-type(3)) > pre:nth-of-type(2),
.deck--player .slide-body:has(> pre:nth-of-type(2)):not(:has(> pre:nth-of-type(3))) > pre:nth-of-type(2) {
  grid-column: 2;
  grid-row: 3;
}
.deck--player .slide-body:has(> pre:nth-of-type(3)) > pre:nth-of-type(3) {
  grid-column: 3;
  grid-row: 3;
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

/* Presenter popout trigger (Task A) — only exists in player mode; deck.js
   creates/removes it alongside the hint bar. Opposite corner from the exit
   hint so it never collides with the keycap bar's live count. */
.deck-presenter-btn {
  position: fixed;
  inset-block-start: 1.2rem;
  inset-inline-end: 1.2rem;
  z-index: 5;
  padding: .5em .9em;
  border: 1px solid var(--accent);
  border-radius: 3px;
  background: var(--card);
  color: var(--accent);
  font-family: var(--mono);
  font-size: .72rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  cursor: pointer;
  opacity: .55;
  box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 6px 18px rgba(0,0,0,.10);
}
.deck-presenter-btn:hover, .deck-presenter-btn:focus-visible { opacity: 1; background: var(--accent); color: var(--card); }

/* Shown only when window.open() returned null (popup blocked) — Task A is
   explicit this must never fail silently the night before a talk. */
.deck-popup-warn {
  position: fixed;
  inset-block-start: 4.2rem;
  inset-inline-end: 1.2rem;
  z-index: 6;
  max-inline-size: 20rem;
  padding: .8em 1em;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--card);
  color: var(--ink);
  font-family: var(--mono);
  font-size: .78rem;
  line-height: 1.5;
  box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 6px 18px rgba(0,0,0,.10);
}
.deck-popup-warn a { color: var(--accent); font-weight: 700; }

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
 * Presenter popout (Task C). Scoped entirely under body.presenter, so none
 * of it can leak into the deck or reading mode, and none of it reads
 * --card-w / --step-x/y / --type-scale -- this is a fixed grid, not the
 * camera. Ground truth for the markup is src/render/talks.js's
 * renderPresenterPage: a bare <body class="presenter" data-slug="…"> (no
 * layout(), no nav/footer) wrapping one <div class="presenter-layout">.
 *
 * That page embeds the deck's own theme stylesheet same as the audience
 * page, but nothing on it carries class="deck" (only .slide-card, reused
 * via slideCardInner, does), so a theme's ".deck { --card: ... }" override
 * never matches here at all. public/talks/deck.js bridges the *audience*
 * page's real computed token values onto <body> once it loads a hidden
 * iframe of /talks/<slug> — the tokens below are only the pre-JS/no-JS
 * fallback, deliberately dark since a presenter view is backstage.
 * ------------------------------------------------------------------ */
body.presenter {
  --card: #1c1d22;
  --ink: #eceef2;
  --muted: #9096a3;
  --accent: #6cd4ff;
  --rule: #33353d;
  --deck-bg: #101015;

  margin: 0;
  min-block-size: 100dvh;
  background: var(--rule);
  color: var(--ink);
  font-family: var(--serif);
}

.presenter-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 26vw);
  grid-template-rows: 1fr auto;
  gap: 1px;
  /* Was min-block-size, which only sets a FLOOR: .presenter-notes spans both
     rows, and a grid track's "auto" max-sizing function still grows to a
     spanning item's max-content regardless of overflow:auto on that item --
     verified a long-notes slide on the real deck pushed this to 1572px tall
     against a 900px viewport, with notes.scrollHeight matching its rendered
     height exactly (i.e. never actually scrolling; the whole page did). A
     definite block-size instead caps the grid itself, which is what lets
     .presenter-notes's own overflow: auto become a real internal scrollbar. */
  block-size: 100dvh;
}

.presenter-notes {
  grid-column: 1;
  grid-row: 1 / 3;
  /* .presenter-notes spans both rows of a "1fr auto" template. A grid
     container's own block-size (above) bounds the OUTER box, but it does
     NOT cap an "auto" row's max-content sizing function -- an item spanning
     into that row still grows the row (and the whole grid) to fit its
     content, verified: a long-notes slide pushed .presenter-layout to
     1572px against a 900px viewport even with block-size: 100dvh set on it.
     Capping the ITEM's own box directly is what makes its max-content
     contribution bounded, which is what lets overflow: auto below become a
     real internal scrollbar instead of growing the page. */
  max-block-size: 100dvh;
  padding: clamp(1.75rem, 3vw, 3.25rem);
  /* The fixed .presenter-nav bar floats over this column's bottom edge;
     without extra clearance it can sit on top of the last line of notes
     text when a slide's notes run long enough to need the scrollbar. */
  padding-block-end: calc(clamp(1.75rem, 3vw, 3.25rem) + 3.4rem);
  overflow: auto;
  background: var(--deck-bg);
  font-size: clamp(1.2rem, 1rem + 1.1vw, 2rem);
  line-height: 1.55;
}
.presenter-notes .presenter-notes-empty { opacity: .45; font-style: italic; }
.presenter-notes > :first-child { margin-block-start: 0; }
.presenter-notes > :last-child { margin-block-end: 0; }
.presenter-notes h2, .presenter-notes h3 { line-height: 1.2; text-wrap: balance; }
.presenter-notes ul, .presenter-notes ol { padding-inline-start: 1.2em; }
.presenter-notes a { color: var(--accent); }

.presenter-slide {
  padding: 1rem 1rem .5rem;
  background: var(--deck-bg);
  overflow: hidden;
}
.presenter-slide--current { grid-column: 2; grid-row: 1; align-self: end; }
.presenter-slide--next { grid-column: 2; grid-row: 2; opacity: .68; }
.presenter-slide, .presenter-slide * {
  /* .slide-card's own box-sizing: border-box comes from ".deck, .deck *"
     (deck-css.js above); nothing on the presenter page has class="deck" as
     an ancestor of these cloned cards, so without this they fall back to
     content-box and padding adds on top of inline-size: 100% -- verified
     overflowing the card ~43px past its container at 1100px wide before
     this rule existed. */
  box-sizing: border-box;
}
.presenter-slide .slide-card {
  inline-size: 100%;
  block-size: auto;
  aspect-ratio: 16 / 9;
  /* .slide-card's base font-size is a clamp() off the viewport width, tuned
     for a card that IS roughly the viewport (reading mode) or a fraction of
     it capped generously (player mode, --card-w). Neither assumption holds
     for a ~26vw sidebar preview -- verified overflowing text past the
     card's right edge at 1440px wide before this override. */
  font-size: clamp(.55rem, .4rem + .5vw, .8rem);
  overflow-wrap: anywhere;
  pointer-events: none;
  user-select: none;
  /* aspect-ratio only sets a PREFERRED height -- a bullet-heavy slide's own
     min-content still wins and grows the card past it, which pushed
     .presenter-layout taller than 100dvh on the real 22-slide deck (a
     content slide with no notes: current-card measured 274px and the next
     preview 518px against a 161px 16:9 box at 1100px wide, verified via
     getBoundingClientRect), forcing the whole page to scroll and cropping
     the next-slide preview off the bottom of the viewport. This clips the
     preview to its intended small box instead -- previews are secondary
     content per spec, so truncating one is correct where growing the page
     past the viewport is not. */
  overflow: hidden;
}
.presenter-slide-label {
  margin: 0 0 .5em;
  font-family: var(--mono);
  font-size: .72rem;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--muted);
}

.presenter-position, .presenter-timer {
  position: fixed;
  inset-block-start: .9rem;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: .6em;
  padding: .4em .8em;
  border-radius: 4px;
  background: color-mix(in srgb, var(--deck-bg) 75%, transparent);
  font-family: var(--mono);
  font-size: .95rem;
  letter-spacing: .04em;
  color: var(--ink);
}
.presenter-position { inset-inline-start: .9rem; }
.presenter-pos-coord { opacity: .6; }
.presenter-timer { inset-inline-end: .9rem; }
.timer-display { font-size: 1.35em; font-variant-numeric: tabular-nums; }
.timer-controls { display: flex; gap: .4em; }
.presenter-timer button {
  font: inherit;
  font-size: .62rem;
  letter-spacing: .1em;
  text-transform: uppercase;
  padding: .3em .65em;
  border: 1px solid var(--muted);
  border-radius: 3px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}
.presenter-timer button:hover, .presenter-timer button:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
}

/* Prev/Next (owner request: presenter needs its own nav, not just the deck
   window's). Built entirely in public/talks/deck.js -- no markup for this
   ships from src/render/talks.js -- so it's styled here as chrome floating
   over .presenter-layout, matching .presenter-position/.presenter-timer's
   fixed-badge treatment rather than taking a layout track of its own. */
.presenter-nav {
  position: fixed;
  inset-block-end: .9rem;
  inset-inline: 0;
  z-index: 3;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: .9em;
  pointer-events: none;
}
.presenter-nav-btn {
  pointer-events: auto;
  font: inherit;
  font-family: var(--mono);
  font-size: .78rem;
  letter-spacing: .06em;
  text-transform: uppercase;
  padding: .5em 1em;
  border: 1px solid var(--muted);
  border-radius: 4px;
  background: color-mix(in srgb, var(--deck-bg) 82%, transparent);
  color: var(--ink);
  cursor: pointer;
}
.presenter-nav-btn:hover:not(:disabled),
.presenter-nav-btn:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
}
.presenter-nav-btn:disabled {
  opacity: .35;
  cursor: default;
}
/* The actual authored-sequence direction (spec: slides sit on a 2D map, so
   "next" may walk right, down, up or diagonally) plus, when it differs, the
   branch a vertical arrow-key press would reach instead -- the one thing a
   linear counter can never tell a presenter. */
.presenter-nav-dir {
  min-inline-size: 1.4em;
  font-family: var(--mono);
  font-size: .95rem;
  letter-spacing: .04em;
  color: var(--accent);
  text-align: center;
}

@media (max-width: 860px) {
  .presenter-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr;
  }
  .presenter-slide--current { grid-column: 1; grid-row: 1; align-self: stretch; }
  .presenter-slide--next { grid-column: 1; grid-row: 2; }
  .presenter-notes { grid-column: 1; grid-row: 3; }
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
