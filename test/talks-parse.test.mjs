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
<!-- speaker: Ryan -->

# One
`),
    /unknown slide key: speaker/,
  );
});

// --- notes ----------------------------------------------------------------

test("notes: absent slide has notes === null, not empty string", () => {
  const [slide] = parseDeck(MINIMAL).slides;
  assert.equal(slide.notes, null);
});

test("notes: single-line comment renders and is absent from html", () => {
  const { slides } = parseDeck(`---
title: Notes
---

<!-- pos: 0,0 -->
<!-- notes: Six engineers, not sixty -->

# One
`);
  assert.equal(slides[0].notes, "<p>Six engineers, not sixty</p>");
  assert.doesNotMatch(slides[0].html, /Six engineers/);
});

test("notes: multi-line block renders markdown bullets to <ul> and mid-body placement is stripped from html", () => {
  const { slides } = parseDeck(`---
title: Notes
---

<!-- pos: 1,0 -->
<!-- kicker: 01 - Scope -->

# Two surfaces, orthogonal

<!-- notes:
- Six engineers, not sixty
- Don't oversell the monorepo
- If asked about C++: it was a wrapper
-->

Body copy the audience sees.
`);
  assert.equal(slides.length, 1);
  assert.match(slides[0].notes, /<ul>/);
  assert.match(slides[0].notes, /Six engineers, not sixty/);
  assert.match(slides[0].notes, /If asked about C\+\+: it was a wrapper/);
  assert.doesNotMatch(slides[0].html, /Six engineers/);
  assert.equal(
    slides[0].html,
    "<h2>Two surfaces, orthogonal</h2>\n<p>Body copy the audience sees.</p>",
  );
});

for (const marker of ["notes:", "notes", "note:", "note"]) {
  test(`notes: single-line marker "<!-- ${marker} ... -->" is recognised`, () => {
    const { slides } = parseDeck(`---
title: Notes
---

<!-- pos: 0,0 -->
<!-- ${marker} Six engineers, not sixty -->

# One
`);
    assert.equal(slides[0].notes, "<p>Six engineers, not sixty</p>");
    assert.doesNotMatch(slides[0].html, /Six engineers/);
  });

  test(`notes: multi-line marker "<!-- ${marker}" is recognised`, () => {
    const { slides } = parseDeck(`---
title: Notes
---

<!-- pos: 0,0 -->

# One

<!-- ${marker}
- Six engineers, not sixty
-->
`);
    assert.match(slides[0].notes, /Six engineers, not sixty/);
    assert.doesNotMatch(slides[0].html, /Six engineers/);
  });
}

test("an unrecognised comment block before pos does not break the slide", () => {
  const { slides } = parseDeck(`---
title: Prompt prep
---

<!-- Prompt: draft this slide about the migration, keep it punchy -->

<!-- pos: 0,0 -->

# One
`);
  assert.equal(slides.length, 1);
  assert.deepEqual(slides[0].pos, [0, 0]);
  assert.doesNotMatch(slides[0].html, /Prompt/);
});

test("a stray comment block mid-body never reaches the rendered html", () => {
  const { slides } = parseDeck(`---
title: Stray comment
---

<!-- pos: 0,0 -->

# One

<!-- Reminder: don't mention the acquisition, it's not public yet -->

Body copy the audience sees.
`);
  assert.equal(slides.length, 1);
  assert.doesNotMatch(slides[0].html, /acquisition/);
  assert.doesNotMatch(slides[0].html, /<!--/);
  assert.doesNotMatch(slides[0].html, /&lt;!--/);
  assert.match(slides[0].html, /Body copy the audience sees/);
});

test("no comment markup of any kind ever reaches rendered slide html, across a deck combining every case", () => {
  const { slides } = parseDeck(`---
title: Leak guard
---

<!-- Prompt: internal deck-prep notes, not for the audience -->

<!-- pos: 0,0 -->
<!-- kicker: 01 -->

# One

<!-- note
- a private thought about Jane Doe
-->

Visible body one.

---

<!-- pos: 1,0 -->
<!-- notes: a candid aside -->

# Two

<!-- Interview prep: ask about the outage -->

Visible body two.
`);
  assert.equal(slides.length, 2);
  for (const s of slides) {
    assert.doesNotMatch(s.html, /<!--/, `slide at ${s.pos}: raw comment leaked`);
    assert.doesNotMatch(s.html, /&lt;!--/, `slide at ${s.pos}: escaped comment leaked`);
    assert.doesNotMatch(s.html, /Jane Doe|Prompt|Interview prep|outage|candid aside/);
  }
  assert.match(slides[0].html, /Visible body one/);
  assert.match(slides[1].html, /Visible body two/);
});

test("notes: an unclosed multi-line block throws rather than swallowing the rest of the deck", () => {
  assert.throws(
    () => parseDeck(`---
title: Unclosed notes
---

<!-- pos: 0,0 -->
<!-- notes:
- never closed

# One
`),
    /notes block opened with <!-- notes: but never closed/,
  );
});

// --- talk fence -----------------------------------------------------------

test("a deck with no talk fence has talk === null, and covers/goal default", () => {
  const { talk, slides } = parseDeck(MINIMAL);
  assert.equal(talk, null);
  assert.deepEqual(slides[0].covers, []);
  assert.equal(slides[0].goal, null);
});

test("talk fence parses prompt and outline, and never reaches rendered html", () => {
  const { talk, slides } = parseDeck(`---
title: Talk
---

\`\`\`talk
P1  Architecture of one SDK/codegen system you own
P2  Where language idioms did not map onto the shared spec

O1  [P1]     What OpenTDF is
O2  [P1,P2]  Conformance as ambiguity detection
\`\`\`

<!-- pos: 0,0 -->

# One
`);
  assert.deepEqual(talk.prompt, [
    { id: "P1", text: "Architecture of one SDK/codegen system you own" },
    { id: "P2", text: "Where language idioms did not map onto the shared spec" },
  ]);
  assert.deepEqual(talk.outline, [
    { id: "O1", covers: ["P1"], text: "What OpenTDF is" },
    { id: "O2", covers: ["P1", "P2"], text: "Conformance as ambiguity detection" },
  ]);
  assert.equal(slides.length, 1);
  assert.doesNotMatch(slides[0].html, /Architecture of one SDK|OpenTDF|TALK_ONLY/);
  assert.doesNotMatch(slides[0].html, /```talk|P1|O1/);
});

test("talk fence: ids may carry a trailing lowercase letter, e.g. P1a", () => {
  const { talk } = parseDeck(`---
title: Talk
---

\`\`\`talk
P1   First
P1a  Sub-point of first

O1  [P1a]  Covers the sub-point
\`\`\`

<!-- pos: 0,0 -->

# One
`);
  assert.deepEqual(talk.prompt.map((p) => p.id), ["P1", "P1a"]);
  assert.deepEqual(talk.outline[0].covers, ["P1a"]);
});

test("slide covers and goal are parsed as ordinary slide metadata", () => {
  const { slides } = parseDeck(`---
title: Talk
---

\`\`\`talk
P1  Something

O1  [P1]  First point
O2  [P1]  Second point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1, O2 -->
<!-- goal: land the point -->

# One
`);
  assert.deepEqual(slides[0].covers, ["O1", "O2"]);
  assert.equal(slides[0].goal, "land the point");
  assert.doesNotMatch(slides[0].html, /covers|goal/);
});

test("covers defaults to empty array (never null) when absent but a talk fence exists", () => {
  const { slides } = parseDeck(`---
title: Talk
---

\`\`\`talk
P1  Something

O1  [P1]  First point
\`\`\`

<!-- pos: 0,0 -->

# One
`);
  assert.deepEqual(slides[0].covers, []);
  assert.equal(slides[0].goal, null);
});

test("talk fence: outline item referencing an unknown prompt id throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Talk
---

\`\`\`talk
P1  Something

O1  [P9]  Bad ref
\`\`\`

<!-- pos: 0,0 -->

# One
`),
    /unknown prompt id: P9/,
  );
});

test("talk fence: a slide covers referencing an unknown outline id throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Talk
---

\`\`\`talk
P1  Something

O1  [P1]  First point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O9 -->

# One
`),
    /unknown outline id: O9/,
  );
});

test("talk fence: duplicate prompt id throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Talk
---

\`\`\`talk
P1  Something
P1  Something else
\`\`\`

<!-- pos: 0,0 -->

# One
`),
    /duplicate prompt id: P1/,
  );
});

test("talk fence: duplicate outline id throws", () => {
  assert.throws(
    () => parseDeck(`---
title: Talk
---

\`\`\`talk
P1  Something

O1  [P1]  First
O1  [P1]  Again
\`\`\`

<!-- pos: 0,0 -->

# One
`),
    /duplicate outline id: O1/,
  );
});

test("a slide covers set when the deck has no talk fence throws", () => {
  assert.throws(
    () => parseDeck(`---
title: No talk
---

<!-- pos: 0,0 -->
<!-- covers: O1 -->

# One
`),
    /covers set but deck has no talk/,
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

test("decks/generation-gave-us-the-surface.md parses, and every slide is well-formed", () => {
  const { slides } = parseDeck(deck("generation-gave-us-the-surface"));
  // Not a fixed count: this deck is living content the owner edits. Assert the
  // invariants that must hold at any length instead.
  assert.ok(slides.length > 0, "the real deck parses to at least one slide");
  for (const s of slides) {
    assert.ok(Array.isArray(s.pos) && s.pos.length === 2, "every slide has an x,y pos");
  }
  assert.equal(new Set(slides.map((s) => String(s.pos))).size, slides.length, "positions are unique");
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
