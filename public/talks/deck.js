// Slidecard player. Plain ES module, no build step, no dependencies.
//
// Reading mode is the default and survives this file failing to load: the
// article is an ordinary vertical document either way, and the only DOM this
// script adds is chrome (a launch button and a keycap hint bar) that it also
// removes on exit.
//
// Geometry is not this file's business. It reads `data-pos` into `--x`/`--y`
// once, and thereafter sets exactly two custom properties on the plane:
// `--cam-x` and `--cam-y`, as plain numbers. Cell spacing, card size and the
// flight easing all live in src/render/deck-css.js (spec 8.1).
//
// DOM contract, emitted server-side:
//   <article class="deck" data-deck>
//     <div class="deck-backdrop"></div>
//     <ol class="slides">
//       <li class="slide" id="s1" data-pos="0,0"><div class="slide-card">...
//
// Public API, hung off the article element as `el.slidecard`:
//   enter(index?)  exit()  goto(index)  next()  prev()  index  slides

const DECKS = '[data-deck]';
const EDITABLE = /^(input|textarea|select)$/i;

function parsePos(slide, i) {
  const raw = (slide.dataset.pos || '').split(',');
  const x = Number.parseFloat(raw[0]);
  const y = Number.parseFloat(raw[1]);
  // A slide with no usable pos still gets a distinct cell so the map never
  // stacks two cards on top of each other.
  return {
    x: Number.isFinite(x) ? x : i,
    y: Number.isFinite(y) ? y : 0,
  };
}

function keycap(...keys) {
  return keys.map((k) => '<kbd>' + k + '</kbd>').join('');
}

function setupDeck(deck) {
  if (deck.slidecard) return deck.slidecard;

  const plane = deck.querySelector('.slides');
  const slides = Array.from(deck.querySelectorAll('.slide'));
  if (!plane || slides.length === 0) return null;

  const pos = slides.map((slide, i) => {
    const p = parsePos(slide, i);
    slide.style.setProperty('--x', String(p.x));
    slide.style.setProperty('--y', String(p.y));
    if (!slide.id) slide.id = 's' + (i + 1);
    return p;
  });

  let index = 0;
  let playing = false;
  let hint = null;
  let count = null;

  /* ---------------------------------------------------------------- *
   * Chrome
   * ---------------------------------------------------------------- */

  const launch = document.createElement('button');
  launch.type = 'button';
  launch.className = 'deck-launch';
  launch.textContent = 'Present';
  launch.addEventListener('click', () => enter());
  deck.append(launch);

  function buildHint() {
    hint = document.createElement('div');
    hint.className = 'deck-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.innerHTML =
      '<span>' + keycap('←', '↑', '↓', '→') + ' move</span>' +
      '<span>' + keycap('Space') + ' next</span>' +
      '<span>' + keycap('F') + ' full screen</span>' +
      '<span>' + keycap('Esc') + ' read</span>' +
      '<span class="deck-count"></span>';
    count = hint.querySelector('.deck-count');
    deck.append(hint);
    paintCount();
  }

  function paintCount() {
    if (count) count.textContent = (index + 1) + ' / ' + slides.length;
  }

  /* ---------------------------------------------------------------- *
   * Camera
   * ---------------------------------------------------------------- */

  function goto(i, opts) {
    const instant = Boolean(opts && opts.instant);
    if (!Number.isInteger(i) || i < 0 || i >= slides.length) return;
    index = i;

    if (instant) plane.style.setProperty('--fly', '0ms');
    plane.style.setProperty('--cam-x', String(pos[i].x));
    plane.style.setProperty('--cam-y', String(pos[i].y));
    if (instant) {
      // Flush the jump before the transition duration comes back.
      void plane.offsetWidth;
      requestAnimationFrame(() => plane.style.removeProperty('--fly'));
    }

    paintCount();
    const id = slides[i].id;
    if (id && '#' + id !== location.hash) {
      try {
        history.replaceState(null, '', '#' + id);
      } catch {
        location.hash = id;
      }
    }
    deck.dispatchEvent(
      new CustomEvent('slidecard:slide', { detail: { index: i, id, pos: pos[i] } }),
    );
  }

  const next = () => goto(Math.min(index + 1, slides.length - 1));
  const prev = () => goto(Math.max(index - 1, 0));

  // Nearest slide sharing the current row (horizontal) or column (vertical).
  function step(axis, dir) {
    const here = pos[index];
    const same = axis === 'x' ? 'y' : 'x';
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < pos.length; i++) {
      if (i === index) continue;
      if (pos[i][same] !== here[same]) continue;
      const d = (pos[i][axis] - here[axis]) * dir;
      if (d > 0 && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) goto(best);
  }

  /* ---------------------------------------------------------------- *
   * Mode
   * ---------------------------------------------------------------- */

  function nearestToScroll() {
    const mid = window.innerHeight / 2;
    let best = 0;
    let bestD = Infinity;
    slides.forEach((slide, i) => {
      const r = slide.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  function enter(i) {
    const target = Number.isInteger(i) ? i : playing ? index : nearestToScroll();
    if (!playing) {
      playing = true;
      deck.classList.add('deck--player');
      document.documentElement.classList.add('deck-presenting');
      deck.tabIndex = -1;
      buildHint();
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('hashchange', onHash);
      deck.focus({ preventScroll: true });
    }
    goto(target, { instant: true });
  }

  function exit() {
    if (!playing) return;
    playing = false;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('hashchange', onHash);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    deck.classList.remove('deck--player');
    document.documentElement.classList.remove('deck-presenting');
    plane.style.removeProperty('--cam-x');
    plane.style.removeProperty('--cam-y');
    plane.style.removeProperty('--fly');
    if (hint) hint.remove();
    hint = null;
    count = null;
    deck.removeAttribute('tabindex');
    slides[index].scrollIntoView({ block: 'center', behavior: 'auto' });
    deck.dispatchEvent(new CustomEvent('slidecard:exit', { detail: { index } }));
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (deck.requestFullscreen) {
      deck.requestFullscreen().catch(() => {});
    }
  }

  /* ---------------------------------------------------------------- *
   * Input
   * ---------------------------------------------------------------- */

  function onKey(e) {
    if (!playing) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (EDITABLE.test(t.tagName) || t.isContentEditable)) return;

    switch (e.key) {
      case 'ArrowRight': step('x', 1); break;
      case 'ArrowLeft': step('x', -1); break;
      case 'ArrowDown': step('y', 1); break;
      case 'ArrowUp': step('y', -1); break;
      // Document order. Presentation remotes send PageDown/PageUp, so they
      // are the same walk as space.
      case ' ':
      case 'Spacebar':
      case 'PageDown':
        if (e.shiftKey) prev(); else next();
        break;
      case 'PageUp':
        if (e.shiftKey) next(); else prev();
        break;
      case 'Home': goto(0); break;
      case 'End': goto(slides.length - 1); break;
      case 'f':
      case 'F': toggleFullscreen(); break;
      case 'Escape': exit(); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  }

  function indexOfHash() {
    const id = location.hash.slice(1);
    if (!id) return -1;
    return slides.findIndex((s) => s.id === id);
  }

  function onHash() {
    const i = indexOfHash();
    if (i >= 0 && i !== index) goto(i);
  }

  const api = {
    enter,
    exit,
    goto: (i) => goto(i),
    next,
    prev,
    slides,
    get index() { return index; },
    get playing() { return playing; },
  };
  deck.slidecard = api;

  // A deck deep-linked mid-talk (#s3) opens in the player; a bare URL does
  // not, because reading is the primary mode.
  const fromHash = indexOfHash();
  if (fromHash >= 0) enter(fromHash);

  return api;
}

function init(root) {
  (root || document).querySelectorAll(DECKS).forEach(setupDeck);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

export { setupDeck, init };
