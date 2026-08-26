// GET /talks             — the deck index, newest first.
// GET /talks/:slug        — one deck, read as a page and flown as a deck.
// GET /deck/pattern.svg   — the glyph tile decks use as a wallpaper.
//
// The registry parses lazily and memoises, so the first request for a deck
// pays for the parse and nothing else does. A deck that fails to parse throws;
// the router's try/catch turns that into a 500 with the file named, which is
// the right outcome — a malformed deck is a deploy bug, not a 404.

import { listDecks, getDeck } from "../talks/registry.js";
import {
  renderTalksIndex,
  renderDeckPage,
  renderPresenterPage,
  patternSvgResponse,
} from "../render/talks.js";

const HTML = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
};

export function handleTalksIndex() {
  return new Response(renderTalksIndex(listDecks()), { headers: HTML });
}

/**
 * Returns null when the slug is not a deck; the router turns that into a 404.
 * `?presenter` serves the standalone presenter view from the same deck data
 * instead of the audience page — it must 404 the same way for an unknown
 * slug, so the lookup happens before the query string is even inspected.
 */
export function handleTalk(request, env, slug) {
  const deck = getDeck(slug);
  if (!deck) return null;
  const url = new URL(request.url);
  const page = url.searchParams.has("presenter") ? renderPresenterPage(deck) : renderDeckPage(deck);
  return new Response(page, { headers: HTML });
}

/**
 * The wallpaper tile. Referenced from deck CSS rather than navigation, which
 * is why it sits outside /talks (§12), and validated as hostile input (§9.1).
 */
export function handlePatternSvg(request) {
  return patternSvgResponse(new URL(request.url));
}
