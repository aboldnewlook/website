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
