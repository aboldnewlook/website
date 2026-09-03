# Slidecard slide components

Date: 2026-08-28
Status: component set accepted; **mechanism superseded**. No implementation
has begun.

> The six components in §5 stand. The way they are *selected* does not.
> §5's `:has()` selectors, §6's shape ledger, and decisions C1/C3/C4/C5 were
> written around structural detection, which caps the library at ~4 more
> components and admits no attributes. The agreed replacement is an
> allowlisted component tag vocabulary parsed in `src/talks/parse.js`
> (deck-only, leaving `src/blog/markdown.js` and its escaping posture
> untouched), wrapping ordinary markdown so a deck still reads as a document:
>
> ```
> <slide-stats columns="4" emphasis="figure">
>
> | Weekly downloads | Stars |
> |---|---|
> | 5.8M | 93.9k |
>
> </slide-stats>
> ```
>
> Verified working end to end as a ~15-line change to `parse.js`. This
> document is kept as-is pending that rewrite, because the component set,
> the emitted-HTML notes and §7's held-back list all survive the change and
> the ledger records why the mechanism was abandoned.

## 1. Context

A deck body is plain markdown. `src/blog/markdown.js` escapes raw HTML, so a
deck author has **no wrapper element and no class** to reach for. The one
component that exists today — multi-column code compare
(`src/render/deck-css.js:365`) — is therefore selected *structurally* with
`:has()`, never authored:

```css
.deck--player .slide-body:has(> pre:nth-of-type(3)) { /* 3-up */ }
```

That constraint is the feature. The author writes ordinary markdown, the
shape is the API, and every deck gets a component the moment it lands in
`deck-css.js` — no classes to remember, no per-deck CSS.

This document extends that one-off into a small library.

## 2. Goals

- More visual range per slide without per-deck customization.
- Every component degrades to something honest in reading mode (D1, D2).
- Zero new authoring syntax. Only shapes the existing parser already emits.

## 3. Non-goals

- An author-facing class, attribute, or directive escape hatch. If a layout
  cannot be reached structurally, it does not ship.
- Per-element builds or animation.
- Changing `src/blog/markdown.js`. Components are CSS-only.

## 4. Decisions

| # | Decision | Rationale |
|---|---|---|
| C1 | Components are selected structurally, never authored | Inherited from code compare. No raw HTML exists to hang a class on. |
| C2 | Every component is `.deck--player`-scoped | D2's scoping rule: reading mode keeps normal block flow. A ~48rem document column is the wrong place for a 4-up figure row. |
| C3 | A shape is a finite resource, spent once | There are ~15 distinguishable shapes (§6). Once one is claimed it cannot be reused, and the leftovers get progressively more contrived. Spend them on what recurs across talks. |
| C4 | Loose/tight list distinction carries intent | A blank line between list items is a deliberate authoring act; a tight list is the default. This is the only way to get an opt-in signal out of a list without false-positiving every bulleted list in every deck. |
| C5 | Ambiguous shapes are left unspent rather than guessed | e.g. `- **5.8M** — Weekly downloads` reads beautifully but would fire on every bolded lead-in list in the repo. Rejected. |

## 5. The library

Six components: one shipped, five proposed. Emitted HTML in each case is
verified against `src/blog/markdown.js`, not assumed.

### 5.1 Big statement

The one-sentence card. The single most common slide in any talk, and it
currently renders at the same scale as a slide with six bullets on it.

**Syntax** — the slide body is a heading and nothing else.

```
<!-- kicker: 02 — The problem -->
# Nobody reads the changelog
```

**Emits** `<h2>` as the sole child of `.slide-body`.

**Selector** `.deck--player .slide-body:not(:has(> :not(h2)))`

**Reading mode** an ordinary `<h2>`.

Costs a shape that is otherwise meaningless — a body-less slide has no other
interpretation — which makes it the cheapest component in the library.

### 5.2 Stat row

A row of figures with captions. For the slide that lands a number.

**Syntax** — a table with exactly one body row. Headers are the labels,
the row is the figures.

```
| Weekly downloads | Stars | Contributors | Followers |
|---|---|---|---|
| 5.8M | 93.9k | 3.0k | 19.2k |
```

**Emits** `<table><thead><tr><th>×n</tr></thead><tbody><tr><td>×n</tr></tbody></table>`

**Selector** `.deck--player .slide-body table:has(tbody tr:only-child)`

**Reading mode** an honest little two-row table.

The figure is authored second and displayed first: grid placement pins each
`<td>` above its `<th>`, the same explicit-placement technique code compare
uses to keep label/code pairs together (`deck-css.js:385`). Authoring it the
other way round would put the labels in `<td>` and the numbers in `<th>`,
which is backwards for reading mode and for anything parsing the page.

Nobody writes a one-body-row table for any other reason, so the
false-positive rate is effectively zero.

### 5.3 Quote

**Syntax** — a blockquote of two paragraphs: the quote, then the attribution.

```
> The best API is the one you never have to read.
>
> — Someone, somewhere
```

**Emits** `<blockquote><p>…</p><p>— Someone, somewhere</p></blockquote>`
(the bare `>` line is captured as empty by `QUOTE`, which splits the
paragraphs).

**Selector** `.deck--player .slide-body blockquote:has(> p:nth-of-type(2))`

**Reading mode** a normal blockquote with an attribution line.

A one-paragraph blockquote stays an ordinary quote. The attribution is
styled by *position* (last paragraph), never by text content — CSS cannot
see the em dash, and should not need to.

### 5.4 Steps

A numbered sequence rendered as a process, not a list: bigger numerals,
generous spacing, one step per beat.

**Syntax** — a **loose** ordered list. Blank lines between the items.

```
1. Publish the schema

2. Generate the client

3. Diff against the last release
```

**Emits** `<ol><li><p>…</p></li>…</ol>` — loose lists keep the `<p>` wrapper
(`markdown.js:196`), tight ones unwrap it.

**Selector** `.deck--player .slide-body ol:has(> li > p)`

**Reading mode** a normal ordered list.

Per C4 this is the whole reason the loose/tight distinction matters: a tight
`1. 2. 3.` list stays an ordinary numbered list, so no existing deck changes
appearance, and the author opts in with a blank line.

### 5.5 Figure

**Syntax** — an image alone on its line.

```
![The dependency graph, before](/decks/my-talk/graph-before.png)
```

**Emits** `<p><img …></p>` — a paragraph whose only child is the image.

**Selector** `.deck--player .slide-body p:has(> img:only-child)`

**Reading mode** a normal inline image.

Full-bleed within the card, with the `alt` available as a caption if we want
one later. An image with text beside it in the same paragraph stays inline.

### 5.6 Code compare — shipped

Two or three code samples side by side, each under a `**bold**` label.
Already implemented at `deck-css.js:365`. Documented here only so the
library reads as one set.

**Selector** `.deck--player .slide-body:has(> pre:nth-of-type(2))` (2-up),
`…:nth-of-type(3)` (3-up).

## 6. The shape ledger

Every structurally distinguishable shape the parser can emit, and what it is
spent on. This is the budget C3 refers to.

| Shape | Selector fragment | Spent on |
|---|---|---|
| body is `h2` only | `:not(:has(> :not(h2)))` | **big statement** |
| 2 sibling `<pre>` | `:has(> pre:nth-of-type(2))` | code compare, 2-up *(shipped)* |
| 3+ sibling `<pre>` | `:has(> pre:nth-of-type(3))` | code compare, 3-up *(shipped)* |
| table, 1 body row | `table:has(tbody tr:only-child)` | **stat row** |
| table, 2+ body rows | — | ordinary table |
| table, no `<tbody>` | `table:not(:has(tbody))` | *free* |
| blockquote, 2 paragraphs | `blockquote:has(> p:nth-of-type(2))` | **quote** |
| nested blockquote | `blockquote > blockquote` | *free* — callout candidate |
| loose `<ol>` | `ol:has(> li > p)` | **steps** |
| tight `<ol>` | — | ordinary numbered list |
| loose `<ul>` | `ul:has(> li > p)` | *free* |
| tight `<ul>` | — | ordinary bullets |
| `<p>` wrapping only an `<img>` | `p:has(> img:only-child)` | **figure** |
| `<hr>` in the body | `:has(> hr)` | literal rule *(documented today)* |
| `<h3>` present | `:has(> h3)` | *free* |

Four shapes remain genuinely free. That is the ceiling to plan against.

## 7. Held back

Deliberately not spent, with the reason:

- **Split / two-up panels**, via `***` → `<hr>`. The natural shape for
  "content, divider, content", and the most-requested layout after code
  compare. Blocked because the authoring skill currently documents `***` as
  *the* way to get a literal rule inside a slide. Spending it silently
  changes the meaning of every `***` already written. Wants an explicit
  decision, not a default.
- **Callout / aside**, via nested blockquote (`>>`). Clean shape, no
  conflict. Held only because it is not yet clear it recurs enough to earn
  one of the four remaining slots.
- **Chips / legend row**, via a header-only table. Distinct and unclaimed,
  but the use case is thin.
- **Bold-led list** as the stat row syntax. Rejected outright per C5.

## 8. Open questions

1. **`stat strip` vs `stat row`** — if the component always spans the card
   full-bleed, "strip" is the accurate word and "row" undersells it. Named
   `stat row` here provisionally; the unit is *a stat* either way.
2. **Does big statement need a size ceiling?** A 14-word "one sentence"
   still has to fit the card at `--card-w`. Probably `clamp()` on the font
   size rather than a validator warning, but worth deciding.
3. **Stat row column count.** Four fits the reference. Six almost certainly
   does not. Degrade by wrapping to a second row, or warn in the validator?
4. **Does the validator learn about components?** It could warn on a
   5-column stat row or a 9-step sequence. Argues for; against is that the
   validator currently checks structure the parser cares about, not taste.
