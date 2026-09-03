# Ledger — generation-gave-us-the-surface

Phase 4 (review). Pinned at `de2a31e` · 22 slides · 30 outline items ·
3 prompt items.

## Dispositions

### Conformance (⑤) — skip live, change nothing

**Decision.** The section stays in the deck exactly as it is. Columns 5 and 6
are simply not presented. No edits queued.

**Why it came up.** It read as not aligning to the prompt, and as a place to
save time.

**What the audit found.**

- Skipping is safe for coverage. All four Conformance items tag `[P1]` only,
  and P1 is covered by 15 other outline items across 11 other slides.
  `talk-coverage` still reports 100% with the section undelivered.
- Time saved is real: `5,0` (101 words) and `6,0` (152 words, the heaviest
  slide in the deck) are about 2 minutes of a 6.1-minute spine.
- **The dissent, recorded because it was not accepted:** the section is
  arguably mis-filed rather than misaligned. `divergence-evidence` ("third
  parties misread the spec, then internal SDKs disagreed too") and
  `spec-is-what-changes` ("divergence reveals underspecification") are the
  deck's most direct evidence for **P2**, where language idioms did not map
  cleanly onto the shared spec — yet both are tagged `[P1]`. Prompt balance
  is P1 13 slides / P2 4 / P3 6, so P2 is the starved third of the brief and
  this is the material that would feed it.
- Both Conformance slides sit on the **spine**, so the skip is two column
  jumps taken live rather than a designed drop. The framework's mechanism for
  "valuable but droppable" is a `down` vertical; these are in the one place
  that cannot be dropped cleanly.

**Revisit if:** P2 feels thin in rehearsal, or the live skip is awkward twice
in a row. The cheap fix is retagging, not rewriting — the slides already
exist.

## Open items not dispositioned

- Residual outline items with no slide: `feature-parity` (① The problem),
  `platform-uses-sdk` (③ Generation).
- Slide `4,2` wears the "05 — Conformance" kicker but covers `shared-cli-shape`
  (④ Idioms) and `cli-dogfoods` (③ Generation). The kicker is wrong for the
  work it does; unrelated to the skip decision.
- Three verticals outweigh their spine slides (`talk-coverage` warns):
  "Their environment gives you no signals", "The contract validates too",
  "Language idioms diverge. Unix idioms converged."
