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
//
// Presenter popout (spec: popout presenter window for speaker notes).
// `/talks/<slug>?presenter` is a SEPARATE page, rendered by
// src/render/talks.js's renderPresenterPage — that is ground truth for this
// script's presenter-side DOM expectations, not this comment; skim it before
// changing anything below. In short: `<body class="presenter" data-slug="…">`,
// `.presenter-slide--current` / `.presenter-slide--next` each holding a bare
// `.slide-card` (+ a `.presenter-slide-label` on next), `.presenter-notes`,
// `.presenter-position[data-pos]`, and timer hooks `[data-timer-display]` /
// `[data-timer-start]` / `[data-timer-pause]` / `[data-timer-reset]` — no
// JS wiring for the timer ships from that side, this file owns all of it.
//
// That page is stateless and renders only slide 1 (current) and slide 2
// (next): no hidden full-deck data island ships with it, so this script has
// no way to reach slide 7's card/notes/pos, or the deck's real theme (no
// element on this page carries class="deck", so a theme's
// `.deck { --card: … }` override never matches here) purely from this
// document. setupPresenter() below solves both by loading the audience page
// (`/talks/<slug>`, same origin, no query) into a hidden iframe — that page
// does carry the full .slide/.slide-notes contract for every slide, and is
// a genuinely rendered document (unlike a DOMParser parse), so its computed
// styles reflect any theme for real.
//
// Sync is a BroadcastChannel named `slidecard:<slug>`. The deck is the
// authority on "current index": it broadcasts {type:'slide', index} on every
// goto(), whatever the origin (a local key press, or a command applied from
// the presenter). The presenter never re-broadcasts on receipt of a 'slide'
// message — only a *user* action in the presenter sends
// {type:'command', command:'next'|'prev'|'goto', index}. That asymmetry is
// what keeps this from ping-ponging: "apply incoming state" and "user
// navigated, tell the other side" are separate code paths on both ends. Every
// message also carries a random per-page-load `source`, and both ends ignore
// a message carrying their own — belt-and-suspenders against a browser that
// ever echoes a channel's own post back to itself.

const DECKS = '[data-deck]';
const EDITABLE = /^(input|textarea|select)$/i;
const THEME_VARS = [
  '--card', '--ink', '--muted', '--accent', '--rule', '--deck-bg',
  '--serif', '--mono', '--card-radius', '--card-shadow',
];

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

// Arrow glyph for the authored-sequence move from one pos to another. Slides
// sit on a 2D map (spec 8.1), so "next" in document order can walk right,
// down, up, left, or diagonally -- a linear counter can't tell a presenter
// which. Pure function of two {x,y} points, shared by render() below.
function directionArrow(from, to) {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (dx > 0 && dy > 0) return '↘'; // ↘
  if (dx > 0 && dy < 0) return '↗'; // ↗
  if (dx < 0 && dy > 0) return '↙'; // ↙
  if (dx < 0 && dy < 0) return '↖'; // ↖
  if (dx > 0) return '→'; // →
  if (dx < 0) return '←'; // ←
  if (dy > 0) return '↓'; // ↓
  if (dy < 0) return '↑'; // ↑
  return '';
}

// Slug source for both the channel name and the popout URL. data-slug wins
// when present (the presenter page's fixed contract); URL parsing is the
// fallback so the main deck page works even before it carries data-slug too.
function getSlug() {
  const attr = document.documentElement.dataset.slug || document.body.dataset.slug;
  if (attr) return attr;
  const m = location.pathname.match(/\/talks\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

function openChannel(slug, onMessage) {
  if (!slug || !('BroadcastChannel' in window)) return null;
  const channel = new BroadcastChannel('slidecard:' + slug);
  channel.onmessage = onMessage;
  return channel;
}

// Read slide geometry off the DOM once. Shared by the player (which also
// paints --x/--y for the camera) and the presenter (which only needs the
// data, never shows this element).
function readSlides(deck) {
  const slides = Array.from(deck.querySelectorAll('.slide'));
  const pos = slides.map((slide, i) => {
    const p = parsePos(slide, i);
    slide.style.setProperty('--x', String(p.x));
    slide.style.setProperty('--y', String(p.y));
    if (!slide.id) slide.id = 's' + (i + 1);
    return p;
  });
  return { slides, pos };
}

// Nearest slide sharing `here`'s row (axis 'x') or column (axis 'y'), in
// direction `dir`. Pure function of pos/index so both the player and the
// presenter's local arrow-key handling can share it.
function nearestStep(pos, index, axis, dir) {
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
  return best;
}

function setupDeck(deck) {
  if (deck.slidecard) return deck.slidecard;

  const plane = deck.querySelector('.slides');
  const { slides, pos } = readSlides(deck);
  if (!plane || slides.length === 0) return null;

  const slug = getSlug();
  let index = 0;
  let playing = false;
  let hint = null;
  let count = null;
  let presenterBtn = null;
  let popupWarn = null;
  const sourceId = 'deck-' + Math.random().toString(36).slice(2);
  const channel = openChannel(slug, onChannelMessage);

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
      '<span>' + keycap('S') + ' presenter</span>' +
      '<span>' + keycap('Esc') + ' read</span>' +
      '<span class="deck-count"></span>';
    count = hint.querySelector('.deck-count');
    deck.append(hint);
    paintCount();
  }

  function paintCount() {
    if (count) count.textContent = (index + 1) + ' / ' + slides.length;
  }

  function buildPresenterButton() {
    presenterBtn = document.createElement('button');
    presenterBtn.type = 'button';
    presenterBtn.className = 'deck-presenter-btn';
    presenterBtn.textContent = 'Presenter';
    presenterBtn.addEventListener('click', () => openPresenter());
    deck.append(presenterBtn);
  }

  /* ---------------------------------------------------------------- *
   * Presenter popout + sync (Task A/B)
   * ---------------------------------------------------------------- */

  // Must be called synchronously from a real user gesture (click / keydown)
  // or popup blockers eat it (spec A) — no await before this line anywhere
  // in its callers.
  function openPresenter() {
    if (!slug) return;
    const url = '/talks/' + encodeURIComponent(slug) + '?presenter';
    const win = window.open(url, 'slidecard-presenter', 'width=1100,height=800');
    if (!win || win.closed) showPopupWarning(url);
    else if (popupWarn) {
      popupWarn.remove();
      popupWarn = null;
    }
  }

  function showPopupWarning(url) {
    if (popupWarn) return;
    popupWarn = document.createElement('div');
    popupWarn.className = 'deck-popup-warn';
    popupWarn.innerHTML =
      'Popup blocked. <a href="' + url + '" target="_blank" rel="noopener">Open presenter notes</a>';
    deck.append(popupWarn);
  }

  function onChannelMessage(ev) {
    const msg = ev.data;
    if (!msg || msg.source === sourceId) return;
    if (msg.type === 'hello') {
      channel.postMessage({ type: 'slide', index, source: sourceId });
      return;
    }
    if (msg.type !== 'command') return;
    // A command can arrive before the deck has ever entered player mode
    // (the presenter was opened, or reloaded, while the deck sat in reading
    // mode). Enter first so the animated nav below has a camera to move.
    if (!playing) enter();
    if (msg.command === 'goto' && Number.isInteger(msg.index)) goto(msg.index);
    else if (msg.command === 'next') next();
    else if (msg.command === 'prev') prev();
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
    // Every navigation, whatever its origin (a local key press or a command
    // applied from the presenter below) — the deck is the sync authority.
    if (channel) channel.postMessage({ type: 'slide', index: i, source: sourceId });
  }

  const next = () => goto(Math.min(index + 1, slides.length - 1));
  const prev = () => goto(Math.max(index - 1, 0));

  // Nearest slide sharing the current row (horizontal) or column (vertical).
  function step(axis, dir) {
    const best = nearestStep(pos, index, axis, dir);
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
      buildPresenterButton();
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
    if (presenterBtn) presenterBtn.remove();
    presenterBtn = null;
    if (popupWarn) popupWarn.remove();
    popupWarn = null;
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
      case 's':
      case 'S': openPresenter(); break;
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

/* ---------------------------------------------------------------- *
 * Presenter page (real contract, from src/render/talks.js's
 * renderPresenterPage — see that file for ground truth). It ships NO
 * hidden full-slide data island: only the current and next slide are
 * server-rendered (.presenter-slide--current / --next, each a bare
 * .slide-card), because the route is stateless and always starts at
 * slide 1. That leaves this script with no way to reach slide 7's card,
 * notes or pos coordinate from this document's own DOM.
 *
 * Fix: this document is same-origin with the audience page
 * (/talks/<slug>, no query), which DOES carry every slide's full markup
 * per the fixed .slide/.slide-notes contract — and, critically, is the
 * only place the deck's *rendered* theme (its <style> block's
 * `.deck { --card: ...}` override) actually applies, since no element on
 * the presenter page itself carries class="deck". So it's loaded into a
 * hidden, same-origin <iframe>, which is a real rendered document (unlike
 * a DOMParser parse): its computed styles are genuine, and its .slide
 * nodes can be cloned wholesale. That single fetch is this page's entire
 * data and theme source.
 * ---------------------------------------------------------------- */

function setupPresenter() {
  const slug = getSlug();
  const sourceId = 'presenter-' + Math.random().toString(36).slice(2);
  const channel = openChannel(slug, onChannelMessage);

  const els = {
    currentBox: document.querySelector('.presenter-slide--current'),
    nextBox: document.querySelector('.presenter-slide--next'),
    nextLabel: document.querySelector('.presenter-slide--next .presenter-slide-label'),
    notes: document.querySelector('.presenter-notes'),
    position: document.querySelector('.presenter-position'),
    timerDisplay: document.querySelector('[data-timer-display]'),
  };

  let slides = [];
  let pos = [];
  let index = 0;
  let ready = false; // true once the iframe's full slide list has loaded
  let pendingIndex = null; // an index that arrived (hello reply / command) before ready

  // Prev/Next controls (owner request: "need buttons for next and previous
  // slide"). No markup ships for these from src/render/talks.js, so they're
  // built here the same way deck.js already builds the launch/hint/presenter
  // chrome for the audience page -- plain DOM, styled under .presenter in
  // deck-css.js.
  const nav = document.createElement('div');
  nav.className = 'presenter-nav';
  nav.innerHTML =
    '<button type="button" class="presenter-nav-btn" data-presenter-prev disabled>' +
    '<span aria-hidden="true">←</span> Prev</button>' +
    '<span class="presenter-nav-dir" data-presenter-dir></span>' +
    '<button type="button" class="presenter-nav-btn" data-presenter-next disabled>' +
    'Next <span aria-hidden="true">→</span></button>';
  document.body.append(nav);
  const navPrev = nav.querySelector('[data-presenter-prev]');
  const navNext = nav.querySelector('[data-presenter-next]');
  const navDir = nav.querySelector('[data-presenter-dir]');
  navPrev.addEventListener('click', () => userPrev());
  navNext.addEventListener('click', () => userNext());

  function renderNav() {
    if (!ready) return;
    navPrev.disabled = index <= 0;
    navNext.disabled = index >= slides.length - 1;

    if (index < slides.length - 1) {
      const arrow = directionArrow(pos[index], pos[index + 1]);
      // A vertical neighbour (down, then up) that ISN'T the authored-next
      // slide is the thing a linear counter can never show: a branch the
      // presenter could reach off-script. Only surface it when it differs
      // from the move Next already makes.
      const down = nearestStep(pos, index, 'y', 1);
      const up = nearestStep(pos, index, 'y', -1);
      const branch = down >= 0 && down !== index + 1 ? '↓' : up >= 0 && up !== index + 1 ? '↑' : '';
      navDir.textContent = branch ? arrow + '  (' + branch + ' also available)' : arrow;
    } else {
      navDir.textContent = '';
    }
  }

  function render() {
    if (!ready) return;
    const cur = slides[index];
    const nxt = slides[Math.min(index + 1, slides.length - 1)];

    if (els.currentBox) {
      const card = cur.querySelector('.slide-card');
      const old = els.currentBox.querySelector('.slide-card');
      if (card) {
        if (old) old.replaceWith(card.cloneNode(true));
        else els.currentBox.append(card.cloneNode(true));
      }
    }
    if (els.nextBox) {
      if (els.nextLabel) {
        els.nextLabel.textContent = index < slides.length - 1 ? 'Next' : 'Last slide';
      }
      const card = nxt.querySelector('.slide-card');
      const old = els.nextBox.querySelector('.slide-card');
      if (card) {
        if (old) old.replaceWith(card.cloneNode(true));
        else els.nextBox.append(card.cloneNode(true));
      }
    }
    if (els.notes) {
      const notes = cur.querySelector('.slide-notes');
      els.notes.innerHTML =
        notes && notes.innerHTML.trim()
          ? notes.innerHTML
          : '<p class="presenter-notes-empty">No notes for this slide.</p>';
    }
    if (els.position) {
      els.position.dataset.pos = pos[index].x + ',' + pos[index].y;
      els.position.innerHTML =
        (index + 1) + ' / ' + slides.length +
        ' <span class="presenter-pos-coord">' + pos[index].x + ', ' + pos[index].y + '</span>';
    }
    renderNav();
  }

  // Applies an index locally with no broadcast — used both for messages
  // arriving off the channel and as the first half of a user-driven nav.
  // Queues rather than drops when the iframe hasn't delivered slide data
  // yet, so a deck window that's ahead of us on load is not lost.
  function applyIndex(i) {
    if (!Number.isInteger(i)) return;
    if (!ready) {
      pendingIndex = i;
      return;
    }
    if (i < 0 || i >= slides.length) return;
    index = i;
    render();
  }

  function send(command, i) {
    if (channel) channel.postMessage({ type: 'command', command, index: i, source: sourceId });
  }

  function userGoto(i) {
    if (!ready || !Number.isInteger(i) || i < 0 || i >= slides.length) return;
    applyIndex(i);
    send('goto', i);
  }
  function userNext() {
    if (!ready) return;
    const i = Math.min(index + 1, slides.length - 1);
    applyIndex(i);
    send('next', i);
  }
  function userPrev() {
    if (!ready) return;
    const i = Math.max(index - 1, 0);
    applyIndex(i);
    send('prev', i);
  }

  function onChannelMessage(ev) {
    const msg = ev.data;
    if (!msg || msg.source === sourceId) return;
    if (msg.type === 'slide' && Number.isInteger(msg.index)) applyIndex(msg.index);
  }

  // Same-origin hidden iframe onto the audience page: the sole source of
  // full slide data (all pos/cards/notes) and the deck's rendered theme.
  function loadSourceDeck() {
    if (!slug) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.inert = true;
    iframe.style.cssText = 'position:fixed;inset:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0;';
    iframe.src = '/talks/' + encodeURIComponent(slug);
    iframe.addEventListener('load', () => {
      let doc, win;
      try {
        doc = iframe.contentDocument;
        win = iframe.contentWindow;
      } catch {
        return; // cross-origin in a dev sandbox is the only realistic cause
      }
      const deckEl = doc && doc.querySelector(DECKS);
      if (!deckEl) return;

      const read = readSlides(deckEl);
      slides = read.slides;
      pos = read.pos;

      // Bridge the deck's real (possibly theme-overridden) token VALUES
      // onto <body> — see the file-header note above. Genuine cascade via
      // getComputedStyle on the iframe's own window, not a guess.
      const cs = win.getComputedStyle(deckEl);
      THEME_VARS.forEach((v) => {
        const val = cs.getPropertyValue(v);
        if (val) document.body.style.setProperty(v, val.trim());
      });

      ready = true;
      if (pendingIndex !== null) {
        const p = pendingIndex;
        pendingIndex = null;
        applyIndex(p);
      } else {
        render();
      }

      // The data is copied out above; the iframe itself is now dead weight
      // -- and worse than dead weight. Verified: Chrome repeatedly moves
      // document.activeElement into it after it finishes loading, even
      // with tabIndex -1, aria-hidden and inert all set, and even after an
      // explicit blur(). Once that happens every subsequent keydown is
      // delivered inside ITS browsing context instead of this page's
      // window listener, so onKey below goes silent with no error --
      // reproduced repeatedly: the first keypress after opening the
      // presenter always worked, every one after it didn't, until this
      // line. Removing the element outright is the only fix that held: an
      // iframe that isn't in the document can't hold focus.
      iframe.remove();
    });
    document.body.append(iframe);
  }

  /* -------------------------------------------------------------- *
   * Same key bindings as the player, translated into user*() calls so
   * they both update this window immediately and post a command back to
   * the deck (Task B — this is the whole feature: focus lives here once
   * the popout is open, so these bindings are the only path the deck gets
   * driven through during a talk).
   * -------------------------------------------------------------- */
  function onKey(e) {
    if (!ready) return; // nothing to navigate yet; see loadSourceDeck()
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (EDITABLE.test(t.tagName) || t.isContentEditable)) return;

    let target;
    switch (e.key) {
      case 'ArrowRight': target = nearestStep(pos, index, 'x', 1); if (target >= 0) userGoto(target); break;
      case 'ArrowLeft': target = nearestStep(pos, index, 'x', -1); if (target >= 0) userGoto(target); break;
      case 'ArrowDown': target = nearestStep(pos, index, 'y', 1); if (target >= 0) userGoto(target); break;
      case 'ArrowUp': target = nearestStep(pos, index, 'y', -1); if (target >= 0) userGoto(target); break;
      case ' ':
      case 'Spacebar':
      case 'PageDown':
        if (e.shiftKey) userPrev(); else userNext();
        break;
      case 'PageUp':
        if (e.shiftKey) userNext(); else userPrev();
        break;
      case 'Home': userGoto(0); break;
      case 'End': userGoto(slides.length - 1); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation();
  }
  window.addEventListener('keydown', onKey, true);

  /* -------------------------------------------------------------- *
   * Elapsed timer: start / pause / reset (Task presenter contract).
   * requestAnimationFrame rather than setInterval so a backgrounded
   * popout (many browsers throttle rAF in a hidden tab too, but never
   * drift like an interval can) still reads a plausible elapsed time —
   * elapsed is always computed from Date.now(), never accumulated tick by
   * tick, so throttling costs display smoothness, not accuracy.
   * -------------------------------------------------------------- */
  let elapsedMs = 0;
  let timerStart = null;
  let timerRaf = null;

  function fmtElapsed(ms) {
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return m + ':' + s;
  }
  function paintTimer() {
    const live = timerStart !== null ? elapsedMs + (Date.now() - timerStart) : elapsedMs;
    if (els.timerDisplay) els.timerDisplay.textContent = fmtElapsed(live);
  }
  function tick() {
    paintTimer();
    timerRaf = requestAnimationFrame(tick);
  }
  function timerStartFn() {
    if (timerStart !== null) return;
    timerStart = Date.now();
    tick();
  }
  function timerPause() {
    if (timerStart === null) return;
    elapsedMs += Date.now() - timerStart;
    timerStart = null;
    if (timerRaf) cancelAnimationFrame(timerRaf);
    paintTimer();
  }
  function timerReset() {
    elapsedMs = 0;
    timerStart = null;
    if (timerRaf) cancelAnimationFrame(timerRaf);
    paintTimer();
    updateToggleLabel();
  }
  // Owner: "when the timer isn't started I shouldn't be able to click pause;
  // when the timer is running I shouldn't be able to click start" -- the
  // two-button markup from src/render/talks.js can't express that on its
  // own, and this script doesn't own that markup, so the separate Pause
  // button is hidden here and Start becomes a single Start/Pause toggle that
  // always reflects real state.
  function updateToggleLabel() {
    if (startBtn) startBtn.textContent = timerStart !== null ? 'Pause' : 'Start';
  }
  function timerToggle() {
    if (timerStart !== null) timerPause();
    else timerStartFn();
    updateToggleLabel();
  }
  const startBtn = document.querySelector('[data-timer-start]');
  const pauseBtn = document.querySelector('[data-timer-pause]');
  const resetBtn = document.querySelector('[data-timer-reset]');
  if (pauseBtn) pauseBtn.hidden = true;
  if (startBtn) startBtn.addEventListener('click', timerToggle);
  if (resetBtn) resetBtn.addEventListener('click', timerReset);
  updateToggleLabel();
  paintTimer();

  // hello first (cheap, no dependency on slide data) so a deck window that's
  // already open replies with its real index as early as possible; the full
  // slide list loads in parallel and whichever finishes last applies it
  // (see applyIndex's pendingIndex queue).
  if (channel) channel.postMessage({ type: 'hello', source: sourceId });
  loadSourceDeck();

  const api = {
    goto: userGoto,
    next: userNext,
    prev: userPrev,
    get index() { return index; },
    get ready() { return ready; },
  };
  document.body.slidecardPresenter = api;
  return api;
}

function init(root) {
  const scope = root || document;
  if (document.body && document.body.classList.contains('presenter')) {
    if (!document.body.slidecardPresenter) setupPresenter();
  } else {
    scope.querySelectorAll(DECKS).forEach(setupDeck);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}

export { setupDeck, setupPresenter, init };
