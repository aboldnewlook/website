// slug -> deck source, with a lazy, memoised parse.
//
// Decks are bundled as text by the wrangler `[[rules]] type = "Text"` entry, so
// there is still no build step and no new binding: the deck files ship inside
// the Worker script itself. The imports are written out one per deck because
// the Workers bundler resolves imports statically — a dynamic glob would
// resolve to nothing at deploy time and to a 404 at runtime.
//
// Nothing is parsed at module scope. Parsing eagerly here would mean a single
// malformed deck takes down every route in the Worker, including the ones that
// have nothing to do with /talks (design §7).

import { parseDeck, parseDeckMeta } from "./parse.js";

import configFilesAreAnApi from "../../decks/config-files-are-an-api.md";
import generationGaveUsTheSurface from "../../decks/generation-gave-us-the-surface.md";
import readingYourOwnLogs from "../../decks/reading-your-own-logs.md";
import slidecard from "../../decks/slidecard.md";
import whyYourSdkNeedsAChangelog from "../../decks/why-your-sdk-needs-a-changelog.md";

const SOURCES = new Map([
  ["config-files-are-an-api", configFilesAreAnApi],
  ["generation-gave-us-the-surface", generationGaveUsTheSurface],
  ["reading-your-own-logs", readingYourOwnLogs],
  ["slidecard", slidecard],
  ["why-your-sdk-needs-a-changelog", whyYourSdkNeedsAChangelog],
]);

/** slug -> fully parsed deck. Populated on first successful getDeck(). */
const decks = new Map();

/** The index listing, built once on first use. */
let index = null;

/**
 * Every deck's frontmatter, newest first, then by title.
 *
 * Frontmatter only: no slide bodies are rendered, so this stays cheap enough
 * to run on the index page. A deck whose frontmatter does not parse is skipped
 * rather than allowed to blank the index; the tests are the gate that keeps
 * that from happening silently in the first place.
 *
 * @returns {{ slug: string, meta: object }[]}
 */
export function listDecks() {
  if (index) return index;

  const rows = [];
  for (const [slug, src] of SOURCES) {
    try {
      rows.push({ slug, meta: parseDeckMeta(src) });
    } catch (err) {
      console.error(`decks/${slug}.md: ${err.message}`);
    }
  }

  rows.sort((a, b) => {
    const byDate = (b.meta.date ?? "").localeCompare(a.meta.date ?? "");
    return byDate || a.meta.title.localeCompare(b.meta.title);
  });

  index = rows;
  return index;
}

/**
 * One deck, parsed on first request and memoised thereafter.
 *
 * @param {string} slug
 * @returns {{ slug: string, meta: object, theme: string|null, slides: object[] }|null}
 * @throws {Error} if the deck exists but does not parse
 */
export function getDeck(slug) {
  const hit = decks.get(slug);
  if (hit) return hit;

  const src = SOURCES.get(slug);
  if (src === undefined) return null;

  let parsed;
  try {
    parsed = parseDeck(src);
  } catch (err) {
    // Name the file. Without it the message reads as an anonymous parse error
    // in the middle of a request log.
    throw new Error(`decks/${slug}.md: ${err.message}`, { cause: err });
  }

  const deck = { slug, ...parsed };
  decks.set(slug, deck);
  return deck;
}
