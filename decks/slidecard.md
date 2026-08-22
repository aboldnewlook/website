---
title: Slidecard
summary: A deck about the deck framework, written in it. Slides sit on a 2D map, the camera flies between them, and this page still reads with JavaScript off.
fonts:
  - Instrument+Serif:ital@0;1
  - IBM+Plex+Mono:wght@400;500
---

```css theme
.deck {
  --card:  #faf6ee;
  --ink:   #1c1a16;
  --accent:#c8672c;
  --serif: "Instrument Serif", Georgia, serif;
  --mono:  "IBM Plex Mono", ui-monospace, monospace;
}
.deck-backdrop {
  background: radial-gradient(120% 90% at 50% 10%, #221d16 0%, #171410 55%, #100e0b 100%);
}
.deck-backdrop::before {
  background-image: url("/deck/pattern.svg?g=%F0%9F%83%8F&size=54&opacity=0.05");
  --wallpaper-angle: -15deg;
  --wallpaper-drift: 120s;
}
```

<!-- pos: 0,0 -->
<!-- kicker: 01 — Welcome -->

# Slidecard

Slides live on a 2D map. The camera flies between them. Nothing else is on
screen: the card, the wallpaper, and the motion in between.

Press **space** to advance.

---

<!-- pos: 1,0 -->
<!-- kicker: 02 — The map -->

# A tree of slides, one card at a time

This card sits to the right of the first, so the camera flew right to reach it.

The next one hangs *below* this one. Press the down arrow and watch the camera
drop, or press space — it goes to the same place.

---

<!-- pos: 1,1 -->
<!-- kicker: 03 — Coordinates -->

# The map is typed, not inferred

Every slide declares where it sits, in a comment above the body:

```
<!-- pos: 1,1 -->
```

There is no heading depth to interpret and no ordering rule to remember.
Coordinates are bookkeeping you maintain by hand — the price of putting a
slide exactly where you want it.

---

<!-- pos: 2,0 -->
<!-- kicker: 04 — Two ways to travel -->

# Space and arrows disagree, on purpose

You just moved from `1,1` to `2,0` — up *and* across, in a single press. No
arrow key can make that move.

- **Space** walks the authored order, wherever it leads.
- **Arrows** walk the map, one neighbour at a time.

The sequence is the talk. The map is the shape of the talk.

---

<!-- pos: 2,1 -->
<!-- kicker: 05 — Wallpaper -->

# The backdrop is swappable

The card restyles to any theme, and the wallpaper behind it is whatever you
want: a gradient, an image, or the tiled glyph drifting behind this one.

It is one CSS block at the top of this file. There is no token vocabulary to
learn, and nothing to extend when you want something it did not anticipate.

---

<!-- pos: 3,0 -->
<!-- kicker: 06 — The honest part -->

# This page reads without JavaScript

Turn it off and the deck becomes an ordinary document: every slide, in order,
as headings and paragraphs.

The player is an enhancement over that page, not a replacement for it. A talk
you can link to is worth more than a talk you can only watch.
