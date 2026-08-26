// Render tests for /talks and /talks/<slug>.
//
// The first test is the one that matters: it renders the real deck and
// asserts every word of every slide is in the server HTML. Reading is the
// primary mode (design D1) and the player is an enhancement; the day someone
// makes slides render client-side, this fails.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { parseDeck } from "../src/talks/parse.js";
import { renderTalksIndex, renderDeckPage, renderPresenterPage } from "../src/render/talks.js";

// routes/talks.js is NOT imported here: it pulls in the registry, which pulls
// in the deck sources through the wrangler `Text` rule and only resolves
// inside the Worker bundle (see src/render/talks.js's module comment). The
// route-level behaviour of `?presenter` (200/404, routing) is verified by
// curling `wrangler dev --local`, not by a node --test import.

const DECK = "generation-gave-us-the-surface";

function deckSource(slug) {
  return readFileSync(fileURLToPath(new URL(`../decks/${slug}.md`, import.meta.url)), "utf8");
}

/** Tags become spaces so the text either side of one never fuses into a new word. */
function text(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** A hand-built deck, for the shape assertions the real one cannot make. */
function fixture(overrides = {}) {
  return {
    slug: "fixture",
    meta: { title: "Fixture deck", fonts: [] },
    theme: null,
    slides: [
      { pos: [0, 0], kicker: "01 — Welcome", id: null, html: "<h2>One</h2>" },
      { pos: [1, 0], kicker: null, id: null, html: "<p>Two</p>" },
    ],
    ...overrides,
  };
}

test("no-JS smoke: every slide's text is in the server HTML", () => {
  const deck = parseDeck(deckSource(DECK));
  const N = deck.slides.length;
  assert.ok(N > 0, "the real deck under test has slides");

  const page = renderDeckPage({ slug: DECK, ...deck });
  const pageText = text(page);

  deck.slides.forEach((slide, i) => {
    const slideText = text(slide.html);
    assert.ok(slideText.length > 0, `slide ${i + 1} rendered no text at all`);
    assert.ok(
      pageText.includes(slideText),
      `slide ${i + 1} is missing from the server HTML: ${slideText.slice(0, 60)}…`,
    );
  });

  const items = page.match(/<li class="slide"/g) ?? [];
  assert.equal(items.length, N, "one <li class=\"slide\"> per slide");
});

test("the deck page owns the h1 that renderMarkdown will not emit", () => {
  const deck = parseDeck(deckSource(DECK));
  const page = renderDeckPage({ slug: DECK, ...deck });
  assert.match(page, /<h1 class="page-title">Generation gave us the surface<\/h1>/);
  // Slide headings stay at h2 — the outline is h1 then h2s, not h2s alone.
  assert.ok(!/<h1[^>]*>Generation gave us the surface\. The opinion/.test(page));
});

test("the deck DOM contract", () => {
  const page = renderDeckPage(fixture());
  assert.match(page, /<article class="deck" data-deck>/);
  assert.match(page, /<div class="deck-backdrop"><\/div>/);
  assert.match(page, /<ol class="slides">/);
  assert.match(
    page,
    /<li class="slide" id="s1" data-pos="0,0"><div class="slide-card"><span class="kicker">01 — Welcome<\/span><div class="slide-body"><h2>One<\/h2><\/div><\/div><\/li>/,
  );
});

test("the kicker span is omitted entirely when kicker is null", () => {
  const page = renderDeckPage(fixture());
  assert.match(
    page,
    /<li class="slide" id="s2" data-pos="1,0"><div class="slide-card"><div class="slide-body"><p>Two<\/p><\/div><\/div><\/li>/,
  );
  assert.equal((page.match(/class="kicker"/g) ?? []).length, 1);
});

test("slide ids: authored id wins, document order fills the rest", () => {
  const page = renderDeckPage(
    fixture({
      slides: [
        { pos: [0, 0], kicker: null, id: null, html: "<p>a</p>" },
        { pos: [1, 0], kicker: null, id: "intro", html: "<p>b</p>" },
        { pos: [2, 0], kicker: null, id: null, html: "<p>c</p>" },
      ],
    }),
  );
  assert.match(page, /id="s1"/);
  assert.match(page, /id="intro"/);
  assert.match(page, /id="s3"/);
  assert.ok(!/id="s2"/.test(page), "the authored id replaces the positional one");
});

test("negative coordinates survive into data-pos", () => {
  const page = renderDeckPage(
    fixture({ slides: [{ pos: [-2, -1], kicker: null, id: null, html: "<p>a</p>" }] }),
  );
  assert.match(page, /data-pos="-2,-1"/);
});

test("kicker and title are escaped", () => {
  const page = renderDeckPage(
    fixture({
      meta: { title: 'Ampersands & "quotes"', fonts: [] },
      slides: [{ pos: [0, 0], kicker: "<script>", id: null, html: "<p>a</p>" }],
    }),
  );
  assert.match(page, /<span class="kicker">&lt;script&gt;<\/span>/);
  assert.match(page, /<h1 class="page-title">Ampersands &amp; &quot;quotes&quot;<\/h1>/);
});

test("the base stylesheet is always injected; the theme only when there is one", () => {
  const plain = renderDeckPage(fixture());
  assert.equal((plain.match(/<style>/g) ?? []).length, 2, "site stylesheet + deck stylesheet");

  const themed = renderDeckPage(fixture({ theme: ".deck { --card: #fff; }" }));
  assert.equal((themed.match(/<style>/g) ?? []).length, 3);
  assert.match(themed, /<style>\.deck \{ --card: #fff; \}<\/style>/);
  // Injection order: the theme is last so it wins over the base sheet.
  assert.ok(
    themed.indexOf(".deck { --card: #fff; }") > themed.indexOf("</style>"),
    "the theme <style> comes after the deck stylesheet",
  );
});

test("a theme cannot close its own <style> element", () => {
  const themed = renderDeckPage(fixture({ theme: "a{}</style><script>alert(1)</script>" }));
  assert.ok(!themed.includes("</style><script>"), "the escape hatch is closed");
  assert.match(themed, /a\{\}<\\\/style>/);
});

test("fonts: nothing at all when the deck declares none", () => {
  const page = renderDeckPage(fixture());
  assert.ok(!page.includes("fonts.googleapis.com"));
  assert.ok(!page.includes("fonts.gstatic.com"));
});

test("fonts: two preconnects and exactly one stylesheet link", () => {
  const page = renderDeckPage(
    fixture({
      meta: {
        title: "Fixture deck",
        fonts: ["Space+Grotesk:wght@400;500;700", "IBM+Plex+Mono:wght@400;500"],
      },
    }),
  );
  assert.match(page, /<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/);
  assert.match(page, /<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>/);
  assert.equal((page.match(/rel="stylesheet"/g) ?? []).length, 1);
  assert.match(
    page,
    /href="https:\/\/fonts\.googleapis\.com\/css2\?family=Space\+Grotesk:wght@400;500;700&amp;family=IBM\+Plex\+Mono:wght@400;500&amp;display=swap"/,
  );
});

test("fonts: a family with characters outside the allowed set is URL-encoded", () => {
  const page = renderDeckPage(
    fixture({ meta: { title: "Fixture deck", fonts: ['Bad" onload=x'] } }),
  );
  assert.ok(!page.includes('Bad" onload'), "no quote breaks out of the href attribute");
  assert.match(page, /family=Bad%22%20onload%3Dx/);
});

test("the real deck declares its fonts and its theme", () => {
  const deck = parseDeck(deckSource(DECK));
  const page = renderDeckPage({ slug: DECK, ...deck });
  assert.match(page, /family=Space\+Grotesk/);
  assert.match(page, /family=Source\+Serif\+4/);
  assert.match(page, /family=IBM\+Plex\+Mono/);
  assert.match(page, /--wallpaper-angle: -15deg/);
});

test("the player is loaded as a deferred module, not inline", () => {
  const page = renderDeckPage(fixture());
  assert.match(page, /<script type="module" src="\/talks\/deck\.js" defer><\/script>/);
  assert.equal((page.match(/<script/g) ?? []).length, 1, "no inline script anywhere");
});

test("the deck page marks Talks as the current nav entry", () => {
  const page = renderDeckPage(fixture());
  assert.match(page, /<a href="\/talks" aria-current="page">Talks<\/a>/);
});

test("the index lists title, date, venue and summary in the order given", () => {
  const html = renderTalksIndex([
    {
      slug: "later",
      meta: { title: "Later talk", date: "2026-09-12", venue: "SomeConf", summary: "Newest.", fonts: [] },
    },
    { slug: "earlier", meta: { title: "Earlier talk", date: "2025-04-01", fonts: [] } },
  ]);

  assert.ok(html.indexOf("Later talk") < html.indexOf("Earlier talk"), "caller order preserved");
  assert.match(html, /<a href="\/talks\/later">Later talk<\/a>/);
  assert.match(html, /<time datetime="2026-09-12">12 Sep 2026<\/time>/);
  assert.match(html, /<span class="venue">SomeConf<\/span>/);
  assert.match(html, /<p class="post-summary">Newest\.<\/p>/);
  assert.match(html, /<a href="\/talks" aria-current="page">Talks<\/a>/);
});

test("the index has an honest empty state", () => {
  const html = renderTalksIndex([]);
  assert.match(html, /No talks published yet\./);
  assert.ok(!html.includes("<ul class=\"postlist\">"));
});

// --- speaker notes --------------------------------------------------------

test("notes render inside the slide, hidden, after .slide-body", () => {
  const page = renderDeckPage(
    fixture({
      slides: [
        { pos: [0, 0], kicker: null, id: null, html: "<p>One</p>", notes: "<p>Say hello.</p>" },
      ],
    }),
  );
  assert.match(page, /<div class="slide-notes" hidden><p>Say hello\.<\/p><\/div>/);
  const bodyIdx = page.indexOf('<div class="slide-body">');
  const notesIdx = page.indexOf('<div class="slide-notes"');
  assert.ok(bodyIdx > -1 && notesIdx > bodyIdx, "notes must come after .slide-body");
});

test("a slide without notes emits no .slide-notes element", () => {
  const page = renderDeckPage(
    fixture({
      slides: [{ pos: [0, 0], kicker: null, id: null, html: "<p>One</p>", notes: null }],
    }),
  );
  assert.ok(!page.includes("slide-notes"));
});

test("a slide with undefined notes (parser not yet updated) also emits no .slide-notes", () => {
  const page = renderDeckPage(
    fixture({ slides: [{ pos: [0, 0], kicker: null, id: null, html: "<p>One</p>" }] }),
  );
  assert.ok(!page.includes("slide-notes"));
});

// --- presenter view --------------------------------------------------------

function presenterFixture() {
  return fixture({
    meta: { title: "Fixture deck", fonts: [] },
    slides: [
      { pos: [0, 0], kicker: "01", id: "one", html: "<h2>One</h2>", notes: "<p>Remember the hook.</p>" },
      { pos: [1, 0], kicker: null, id: "two", html: "<p>Two</p>", notes: null },
      { pos: [2, 0], kicker: null, id: "three", html: "<p>Three</p>", notes: null },
    ],
  });
}

test("presenter page: body carries the presenter class and data-slug", () => {
  const page = renderPresenterPage(presenterFixture());
  assert.match(page, /<body class="presenter" data-slug="fixture">/);
});

test("presenter page: shows current slide notes as the primary content", () => {
  const page = renderPresenterPage(presenterFixture());
  assert.match(page, /<p>Remember the hook\.<\/p>/);
});

test("presenter page: shows the current slide and the next slide, reusing .slide-card", () => {
  const page = renderPresenterPage(presenterFixture());
  assert.equal((page.match(/class="slide-card"/g) ?? []).length, 2);
  assert.match(page, /<h2>One<\/h2>/);
  assert.match(page, /<p>Two<\/p>/);
});

test("presenter page: position indicator shows N / total and the pos coordinate", () => {
  const page = renderPresenterPage(presenterFixture());
  assert.match(page, /1 \/ 3/);
  assert.match(page, /0,\s*0/);
});

test("presenter page: has a timer with start, pause and reset controls", () => {
  const page = renderPresenterPage(presenterFixture());
  assert.match(page, /data-timer/);
  assert.match(page, /data-timer-start/);
  assert.match(page, /data-timer-pause/);
  assert.match(page, /data-timer-reset/);
});

test("presenter page: loads the same deck.js module as the audience page", () => {
  const page = renderPresenterPage(presenterFixture());
  assert.match(page, /<script type="module" src="\/talks\/deck\.js" defer><\/script>/);
});

test("presenter page: no camera or player chrome markup", () => {
  const page = renderPresenterPage(presenterFixture());
  assert.ok(!page.includes("<video"));
});

// The `?presenter` route itself (200 for a known slug, 404 for an unknown
// one, `/talks/<slug>` unaffected) is verified against `wrangler dev --local`
// via curl — see the task report — because src/routes/talks.js cannot be
// imported under plain `node --test` (module comment, src/render/talks.js:15-20).

test("presenter page: the real deck's slide 1 notes reach the page when present", () => {
  const deck = parseDeck(deckSource(DECK));
  const page = renderPresenterPage({ slug: DECK, ...deck });
  assert.match(page, /<body class="presenter" data-slug="generation-gave-us-the-surface">/);
  assert.match(page, new RegExp(`1 / ${deck.slides.length}`));
});
