import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { parseDeck } from "../src/talks/parse.js";
import { analyzeCoverage, formatReport, isFailing } from "../bin/talk-coverage";

const BIN = new URL("../bin/talk-coverage", import.meta.url).pathname;

function fixtureDir() {
  return mkdtempSync(join(tmpdir(), "talk-coverage-"));
}

function writeDeck(dir, name, src) {
  const p = join(dir, name);
  writeFileSync(p, src);
  return p;
}

const FULLY_COVERED = `---
title: Fully covered
---

\`\`\`talk
P1  First prompt
P2  Second prompt

O1  [P1]  First outline point
O2  [P2]  Second outline point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1 -->
<!-- goal: land P1 -->

# One

---

<!-- pos: 1,0 -->
<!-- covers: O2 -->
<!-- goal: land P2 -->

# Two
`;

const UNCOVERED_PROMPT = `---
title: Uncovered prompt
---

\`\`\`talk
P1  First prompt
P2  Second prompt, never outlined

O1  [P1]  First outline point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1 -->
<!-- goal: land P1 -->

# One
`;

const ORPHAN_SLIDE = `---
title: Orphan slide
---

\`\`\`talk
P1  First prompt

O1  [P1]  First outline point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1 -->
<!-- goal: land P1 -->

# One

---

<!-- pos: 1,0 -->
<!-- goal: filler, covers nothing -->

# Orphan
`;

// --- spine/depth fixtures -----------------------------------------------------
// Explicit pos mode: pos[1] === 0 is the spine, pos[1] > 0 is a vertical
// hanging below the spine slide at the same pos[0].

const UPSIDE_DOWN = `---
title: Upside down
---

\`\`\`talk
P1  Only prompt

O1  [P1]  Only outline point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Spine One

Short line here.

---

<!-- pos: 0,1 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Vertical One

Paragraph one with several words in it to add weight.

Paragraph two with several more words in it to add even more weight.

Paragraph three with several more words in it to add even more weight still.
`;

const CORRECTLY_WEIGHTED = `---
title: Correctly weighted
---

\`\`\`talk
P1  Only prompt

O1  [P1]  Only outline point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Spine Two

Paragraph one with several words in it to add weight.

Paragraph two with several more words in it to add even more weight.

Paragraph three with several more words in it to add even more weight still.

---

<!-- pos: 0,1 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Vertical Two

Short line here.
`;

const ONE_HEAVY_COLUMN = `---
title: One heavy column
---

\`\`\`talk
P1  Only prompt

O1  [P1]  Only outline point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Spine Alpha

Paragraph one of the spine slide.

Paragraph two of the spine slide.

---

<!-- pos: 0,1 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Deep Alpha

Paragraph one of the deep dive.

Paragraph two of the deep dive.

Paragraph three of the deep dive.

Paragraph four of the deep dive.

---

<!-- pos: 1,0 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Spine Beta

Paragraph one of the spine slide.

Paragraph two of the spine slide.

---

<!-- pos: 1,1 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Deep Beta
`;

const CODE_COMPARE_EXEMPT = `---
title: Code compare exempt
---

\`\`\`talk
P1  Only prompt

O1  [P1]  Only outline point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Spine One

Short.

---

<!-- pos: 0,1 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Compare

\`\`\`ts
const a = 1;
\`\`\`

\`\`\`go
var a = 1
\`\`\`

\`\`\`java
int a = 1;
\`\`\`
`;

const DENSITY_WARNINGS_BUT_COVERED = UPSIDE_DOWN; // fully covered, still triggers density warnings

const UNCOVERED_AND_UPSIDE_DOWN = `---
title: Uncovered and upside down
---

\`\`\`talk
P1  First prompt
P2  Second prompt, never outlined

O1  [P1]  First outline point
\`\`\`

<!-- pos: 0,0 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Spine One

Short line here.

---

<!-- pos: 0,1 -->
<!-- covers: O1 -->
<!-- goal: g -->

# Vertical One

Paragraph one with several words in it to add weight.

Paragraph two with several more words in it to add even more weight.

Paragraph three with several more words in it to add even more weight still.
`;

// --- analyzeCoverage / formatReport / isFailing --------------------------------

test("a fully-covered deck reports 100% and is not failing", () => {
  const parsed = parseDeck(FULLY_COVERED);
  const result = analyzeCoverage(parsed);
  assert.equal(result.hasTalk, true);
  assert.equal(result.percentCovered, 100);
  assert.deepEqual(result.uncoveredPrompts, []);
  assert.deepEqual(result.uncoveredOutline, []);
  assert.deepEqual(result.slidesCoveringNothing, []);
  assert.deepEqual(result.slidesWithNoGoal, []);
  assert.equal(isFailing(result), false);
  assert.match(formatReport("fixture", result), /100%/);
});

test("a deck with an uncovered prompt item reports it and is failing", () => {
  const parsed = parseDeck(UNCOVERED_PROMPT);
  const result = analyzeCoverage(parsed);
  assert.deepEqual(result.uncoveredPrompts, ["P2"]);
  assert.equal(result.percentCovered, 50);
  assert.equal(isFailing(result), true);
  assert.match(formatReport("fixture", result), /P2/);
});

test("an orphan slide (covers nothing) is reported, and does not by itself fail the run", () => {
  const parsed = parseDeck(ORPHAN_SLIDE);
  const result = analyzeCoverage(parsed);
  assert.equal(result.slidesCoveringNothing.length, 1);
  assert.deepEqual(result.uncoveredPrompts, []);
  assert.equal(isFailing(result), false);
  assert.match(formatReport("fixture", result), /covering nothing/);
});

test("a deck with no talk fence reports hasTalk: false, sensibly, not a crash", () => {
  const parsed = parseDeck(`---
title: No talk
---

<!-- pos: 0,0 -->

# One
`);
  const result = analyzeCoverage(parsed);
  assert.equal(result.hasTalk, false);
  assert.equal(isFailing(result), false);
  assert.match(formatReport("fixture", result), /no ```talk fence/);
});

// --- CLI wrapper, against real /tmp fixture files -------------------------------

test("CLI: a fully-covered deck exits 0 and prints 100%", () => {
  const dir = fixtureDir();
  const file = writeDeck(dir, "full.md", FULLY_COVERED);
  const out = execFileSync(process.execPath, [BIN, file], { encoding: "utf8" });
  assert.match(out, /100%/);
});

test("CLI: an uncovered prompt item exits non-zero", () => {
  const dir = fixtureDir();
  const file = writeDeck(dir, "gap.md", UNCOVERED_PROMPT);
  assert.throws(() => execFileSync(process.execPath, [BIN, file], { encoding: "utf8" }));
});

test("CLI: an orphan slide is reported in stdout even though the run still exits 0", () => {
  const dir = fixtureDir();
  const file = writeDeck(dir, "orphan.md", ORPHAN_SLIDE);
  const out = execFileSync(process.execPath, [BIN, file], { encoding: "utf8" });
  assert.match(out, /covering nothing/);
});

// --- spine/depth summary and density warnings ---------------------------------

test("an upside-down deck (verticals heavier on average than the spine) warns", () => {
  const parsed = parseDeck(UPSIDE_DOWN);
  const result = analyzeCoverage(parsed);
  assert.ok(result.spineDepth.generalWarning, "expected a general upside-down warning");
  assert.match(formatReport("fixture", result), /upside-down/);
});

test("a correctly-weighted deck (verticals lighter on average) does not warn", () => {
  const parsed = parseDeck(CORRECTLY_WEIGHTED);
  const result = analyzeCoverage(parsed);
  assert.equal(result.spineDepth.generalWarning, null);
  assert.doesNotMatch(formatReport("fixture", result), /upside-down/);
});

test("a specific vertical heavier than the spine slide it hangs off is named by title, even if the deck average is fine", () => {
  const parsed = parseDeck(ONE_HEAVY_COLUMN);
  const result = analyzeCoverage(parsed);
  assert.ok(
    result.spineDepth.verticals.avgLines <= result.spineDepth.spine.avgLines,
    "expected the deck-wide vertical average to not exceed the spine average",
  );
  const report = formatReport("fixture", result);
  assert.match(report, /Deep Alpha/);
  assert.match(report, /Spine Alpha/);
});

test("a slide with 3+ pre blocks (side-by-side code compare) is exempt from the heavier-than-spine warning", () => {
  const parsed = parseDeck(CODE_COMPARE_EXEMPT);
  const result = analyzeCoverage(parsed);
  // The compare slide (4 rendered "lines": title + 3 code chunks) is
  // numerically heavier than its spine ("Spine One", 2 lines) but must be
  // exempted because it has 3+ <pre> blocks.
  const flaggedThisColumn = result.spineDepth.columnWarnings.some(
    (w) => w.includes("Compare") && w.includes("Spine One"),
  );
  assert.equal(flaggedThisColumn, false);
});

test("density warnings never affect exit code: full coverage still exits 0 despite every density warning", () => {
  const parsed = parseDeck(DENSITY_WARNINGS_BUT_COVERED);
  const result = analyzeCoverage(parsed);
  assert.ok(result.spineDepth.generalWarning, "sanity: this fixture should trigger the density warning");
  assert.deepEqual(result.uncoveredPrompts, []);
  assert.equal(isFailing(result), false);

  const dir = fixtureDir();
  const file = writeDeck(dir, "density.md", DENSITY_WARNINGS_BUT_COVERED);
  const out = execFileSync(process.execPath, [BIN, file], { encoding: "utf8" });
  assert.match(out, /upside-down/);
});

test("density warnings never affect exit code: an uncovered prompt still exits non-zero regardless of density", () => {
  const parsed = parseDeck(UNCOVERED_AND_UPSIDE_DOWN);
  const result = analyzeCoverage(parsed);
  assert.ok(result.spineDepth.generalWarning, "sanity: this fixture should trigger the density warning");
  assert.equal(isFailing(result), true);

  const dir = fixtureDir();
  const file = writeDeck(dir, "gap-density.md", UNCOVERED_AND_UPSIDE_DOWN);
  assert.throws(() => execFileSync(process.execPath, [BIN, file], { encoding: "utf8" }));
});
