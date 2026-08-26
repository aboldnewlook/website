# Developing talks systematically

Date: 2026-08-25
Status: design. Slice 1 approved for implementation; later slices are a roadmap, not a commitment.

## 1. The failure this exists to prevent

In the owner's words, after building the first deck conversationally:

> "As I looked at the final results, some significant things were missing."

The talk was built by discussing a subject, walking through slides, and
reviewing the finished product. Nothing in that loop compares the deck against
the thing it was supposed to answer, so a gap is only visible once the slides
look finished — which is the most expensive moment to find it.

The fix is to make the prompt an explicit artifact, tag everything back to it,
and make coverage a mechanical check rather than an act of noticing.

Inspired by ReviewArc (Cairn idea #2): break the work into bite-sized units and
seek agreement on each before moving on.

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Prompt, outline and slides live in ONE deck file | The owner chose it; consistent with the format's one-portable-artifact philosophy. |
| D2 | Prompt and outline live in a fenced ` ```talk ` block | The frontmatter parser is a deliberately tiny YAML subset with no nesting, and this shape needs nesting. A fence reuses the ` ```css theme ` precedent instead of growing a YAML dependency. |
| D3 | Planning data is public | The repo is public and the owner accepted that for prompts, outlines and speaker notes alike. No redaction machinery. |
| D4 | `covers` and `goal` are slide-level HTML comments | They are stripped before render like all other comments, so the audience never sees scaffolding. |
| D5 | Coverage is a deterministic script; quality is agent judgment | Structural gaps are countable and should never depend on an LLM noticing. Whether a slide *lands* is judgment and belongs to a panel. |
| D6 | Analysis before generation | The owner has a finished 22-slide deck. Tagging it and asking "what is missing" is useful immediately; generating a new talk is not yet. |
| D7 | Review lenses run on demand, not by default | Four lenses x 22 slides is 88 dispatches. Cheap signal (the script) always; expensive signal (the panel) when a slide feels wrong. |

## 3. Format

    ```talk
    P1  Architecture of one SDK/codegen system you own
    P2  Where language idioms did not map onto the shared spec
    P3  Where AI fits in that pipeline

    O1  [P1]     What OpenTDF is
    O2  [P1]     The consolidation - 11 services to one monorepo
    O3  [P2]     Idioms vs the shared spec
    O4  [P2,P3]  Conformance as ambiguity detection
    ```

    <!-- pos: 1,0 -->
    <!-- covers: O2 -->
    <!-- goal: land that six engineers forced the SDK bet, not preference -->

Grammar: `P<n>` and `O<n>` at line start; an outline item carries a
bracketed, comma-separated list of prompt ids. Blank lines separate the two
sections. Ids are opaque strings matching `[A-Z][0-9]+`, so `P1a` is legal.

Slide keys: `covers` (comma-separated outline ids, optional) and `goal` (free
text, optional). Both are stripped from rendered output.

## 4. Slice 1 - what gets built now

**Parser.** `parseDeck` gains `deck.talk = { prompt: [{id, text}], outline:
[{id, covers:[], text}] } | null`, and slides gain `covers: string[]` and
`goal: string|null`. The ` ```talk ` fence is extracted before slide splitting,
exactly as the theme fence is, and never reaches `renderMarkdown`.

**Validator.** `validate.mjs` accepts the new fence and keys, and errors on:
an outline item referencing an unknown `P` id; a slide referencing an unknown
`O` id; duplicate ids.

**Coverage tool.** `talk-coverage <deck.md>` reports, deterministically:

- prompt items with no outline item      (a gap in the plan)
- outline items with no slide            (a gap in the deck)
- slides covering nothing                (filler, or an untagged slide)
- slides with no `goal`                  (no contract to test against)
- percentage of prompt items covered by at least one slide, transitively

Exit non-zero when any prompt item is uncovered, so it can gate.

**Backfill.** The owner's deck already contains the raw material: a
`<!-- Prompt` block holding the three actual prompts and an outline. Slice 1
ends with `decks/generation-gave-us-the-surface.md` carrying a real ` ```talk `
block and all 22 slides tagged, and a coverage report the owner can react to.

## 5. Roadmap - later slices, not commitments

**Slice 2 - the review panel.** Four lenses per slide, dispatched in parallel,
each told where the slide sits in the deck because an opener and a closer have
different jobs: goal test, coverage, skeptic in the room, cut test. The two
adversarial lenses gate advancement unless the owner overrides deliberately.

**Slice 3 - the simulated talk.** An agent delivers the whole deck from slides
plus notes and reports where it breaks: transitions that do not follow, notes
promising what the slide does not support, arguments that double back.
Per-slide review cannot see incoherence *between* slides; this can.

**Slice 4 - phased generation with gates.** Prompt intake to agreed
understanding, then outline to agreement, then slides. Each phase gated by the
owner. A ledger file records phase, agreements, and which slides passed which
lens, so the process survives a `/clear` or a week's gap.

## 6. Dependency

The `<!-- down -->` relative-position change should land before slice 2. Tagged
slides get reordered constantly during review, and explicit `pos` makes every
reorder a renumbering of everything after it.

## 7. Out of scope

Rendering the plan to the audience; cross-talk analytics; scoring a talk
against anything other than its own declared prompt.
