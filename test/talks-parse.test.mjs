import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDeck, parseDeckMeta } from "../src/talks/parse.js";

// The registry imports decks/*.md as text, which only the wrangler bundler can
// do, so these tests read the real deck files off disk instead.
const deck = (slug) => readFileSync(new URL(`../decks/${slug}.md`, import.meta.url), "utf8");

const MINIMAL = `---
title: Minimal
---

<!-- pos: 0,0 -->

# One
`;

// --- frontmatter --------------------------------------------------------------

test("frontmatter scalars, and fonts is always an array", () => {
  const { meta } = parseDeck(MINIMAL);
  assert.equal(meta.title, "Minimal");
  assert.deepEqual(meta.fonts, []);
  assert.equal(meta.date, undefined);
});

test("frontmatter lists", () => {
  const { meta } = parseDeck(`---
title: Fonts
date: 2026-09-12
venue: SomeConf
fonts:
  - Instrument+Serif:ital@0;1
  - IBM+Plex+Mono:wght@400;500
---

<!-- pos: 0,0 -->

# One
`);
  assert.deepEqual(meta.fonts, ["Instrument+Serif:ital@0;1", "IBM+Plex+Mono:wght@400;500"]);
  assert.equal(meta.date, "2026-09-12");
  assert.equal(meta.venue, "SomeConf");
});

test("a value may contain a colon: only the first one splits", () => {
  const summary = "A config file is a published interface: every key is a promise.";
  const { meta } = parseDeck(`---
title: Config files are an API
summary: ${summary}
---

<!-- pos: 0,0 -->

# One
`);
  assert.equal(meta.summary, summary);
  assert.equal(meta.title, "Config files are an API");
});

test("missing title throws", () => {
  assert.throws(
    () => parseDeck(`---
venue: SomeConf
---

<!-- pos: 0,0 -->

# One
`),
    /missing required key: title/,
  );
});

test("a file with no frontmatter throws", () => {
  assert.throws(() => parseDeck("<!-- pos: 0,0 -->\n\n# One\n"), /must start with ---/);
});

test("unknown deck key throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Typo
speaker: Ryan
---

<!-- pos: 0,0 -->

# One
`),
    /unknown deck key: speaker/,
  );
});

test("a malformed font entry throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Bad font
fonts:
  - Inter&family=Evil
---

<!-- pos: 0,0 -->

# One
`),
    /font entry fails validation/,
  );
});

// --- theme --------------------------------------------------------------------

test("the theme fence never reaches renderMarkdown", () => {
  const { theme, slides } = parseDeck(`---
title: Themed
---

\`\`\`css theme
.deck { --card: #faf6ee; --sentinel: THEME_ONLY_TOKEN; }
\`\`\`

<!-- pos: 0,0 -->

# One
`);

  assert.match(theme, /THEME_ONLY_TOKEN/);
  assert.equal(slides.length, 1);
  // Two failure modes, both silent, both pinned:
  //  - the fence rendered as a <pre> code block on slide 1
  //  - the fence falling through as a paragraph of raw CSS (markdown.js's
  //    info-string capture is a single token, so "css theme" is not a fence)
  assert.doesNotMatch(slides[0].html, /THEME_ONLY_TOKEN/);
  assert.doesNotMatch(slides[0].html, /language-css|--card|<pre>/);
  assert.equal(slides[0].html, "<h2>One</h2>");
});

test("no theme block yields a null theme", () => {
  assert.equal(parseDeck(MINIMAL).theme, null);
});

test("</style is escaped out of the theme", () => {
  const { theme } = parseDeck(`---
title: Escape
---

\`\`\`css theme
.deck::after { content: "</style><script>alert(1)</script>"; }
\`\`\`

<!-- pos: 0,0 -->

# One
`);
  assert.doesNotMatch(theme, /<\/style/i);
  assert.match(theme, /<\\\/style/);
});

// --- slides -------------------------------------------------------------------

test("slide metadata is consumed, the body is rendered", () => {
  const { slides } = parseDeck(`---
title: Meta
---

<!-- pos: 2,-1 -->
<!-- kicker: 01 — Welcome -->
<!-- id: intro -->

# One

Body text.
`);
  assert.equal(slides.length, 1);
  assert.deepEqual(slides[0].pos, [2, -1]);
  assert.equal(slides[0].kicker, "01 — Welcome");
  assert.equal(slides[0].id, "intro");
  assert.equal(slides[0].html, "<h2>One</h2>\n<p>Body text.</p>");
  assert.doesNotMatch(slides[0].html, /pos|kicker/);
});

test("kicker and id default to null", () => {
  const [slide] = parseDeck(MINIMAL).slides;
  assert.equal(slide.kicker, null);
  assert.equal(slide.id, null);
});

test("slides come back in document order, not pos order", () => {
  const { slides } = parseDeck(`---
title: Order
---

<!-- pos: 5,0 -->

# Five

---

<!-- pos: 0,0 -->

# Zero
`);
  assert.deepEqual(
    slides.map((s) => s.pos),
    [
      [5, 0],
      [0, 0],
    ],
  );
});

test("missing pos throws", () => {
  assert.throws(
    () => parseDeck(`---
title: No pos
---

<!-- kicker: 01 -->

# One
`),
    /slide 1 \(01\): missing required pos/,
  );
});

test("duplicate pos throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Dupe
---

<!-- pos: 1,0 -->

# One

---

<!-- pos: 1, 0 -->

# Two
`),
    /slide 2: duplicate pos 1,0, already used by slide 1/,
  );
});

test("malformed pos throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Bad pos
---

<!-- pos: over there -->

# One
`),
    /pos must be two integers/,
  );
});

test("unknown slide key throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Bad key
---

<!-- pos: 0,0 -->
<!-- notes: speak slowly -->

# One
`),
    /unknown slide key: notes/,
  );
});

// --- documented traps ---------------------------------------------------------

test("a bare --- inside a code fence DOES split the slide (spec §7.1)", () => {
  // The split runs on raw text, before any fence is understood. This deck is
  // authored as two slides; the YAML sample inside the fence makes it three.
  // Asserted rather than fixed: the validator warns the author instead.
  const { slides } = parseDeck(`---
title: Fence trap
---

<!-- pos: 0,0 -->

# One

\`\`\`yaml
---
<!-- pos: 1,0 -->
one: 1
---
<!-- pos: 2,0 -->
two: 2
\`\`\`

<!-- pos: 3,0 -->

# Two
`);
  assert.equal(slides.length, 3);
  assert.deepEqual(
    slides.map((s) => s.pos),
    [
      [0, 0],
      [1, 0],
      [2, 0],
    ],
  );
});

test("a fenced --- with no pos comment after it fails loudly", () => {
  assert.throws(
    () => parseDeck(`---
title: Fence trap
---

<!-- pos: 0,0 -->

\`\`\`yaml
---
title: example
---
\`\`\`

# One
`),
    /slide 2: missing required pos/,
  );
});

test("---- and ' ---' do not split; they render as <hr> inside the slide", () => {
  const { slides } = parseDeck(`---
title: Near misses
---

<!-- pos: 0,0 -->

# One

----

 ---

# Two
`);
  assert.equal(slides.length, 1);
  assert.equal((slides[0].html.match(/<hr>/g) ?? []).length, 2);
});

test("# in a slide body renders <h2>, so the page must own the <h1>", () => {
  assert.equal(parseDeck(MINIMAL).slides[0].html, "<h2>One</h2>");
});

// --- the real decks -----------------------------------------------------------

test("parseDeckMeta reads frontmatter without rendering slides", () => {
  const meta = parseDeckMeta(deck("slidecard"));
  assert.equal(meta.title, "Slidecard");
  assert.deepEqual(meta.fonts, ["Instrument+Serif:ital@0;1", "IBM+Plex+Mono:wght@400;500"]);
});

test("decks/slidecard.md parses to 6 slides", () => {
  const { meta, theme, slides } = parseDeck(deck("slidecard"));
  assert.equal(meta.title, "Slidecard");
  assert.equal(slides.length, 6);
  assert.match(theme, /--card/);
  for (const s of slides) assert.equal(s.pos.length, 2);
});

test("decks/generation-gave-us-the-surface.md parses to 22 slides", () => {
  const { slides } = parseDeck(deck("generation-gave-us-the-surface"));
  assert.equal(slides.length, 22);
});

test("every deck in decks/ parses and has unique positions", () => {
  for (const slug of [
    "config-files-are-an-api",
    "generation-gave-us-the-surface",
    "reading-your-own-logs",
    "slidecard",
    "why-your-sdk-needs-a-changelog",
  ]) {
    const { meta, slides } = parseDeck(deck(slug));
    assert.ok(meta.title, `${slug}: title`);
    assert.ok(slides.length > 0, `${slug}: slides`);
    assert.equal(new Set(slides.map((s) => s.pos.join(","))).size, slides.length, slug);
  }
});
