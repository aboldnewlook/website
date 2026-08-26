// Slidecard deck parser: deck markdown -> { meta, theme, slides[] }.
//
// The parse order is strict and each step consumes its input before the next
// step sees it (design §7):
//
//   1. deck frontmatter, only if the file starts with `---`
//   2. the first ```css theme fence, removed from the source
//   3. split what remains on /^---$/m into slides
//   4. per slide, pull the `<!-- notes: ... -->` block (single- or
//      multi-line, anywhere in the body) out before anything else runs.
//      "notes" and "note" both work, colon optional, on either form.
//   5. per slide, consume the leading <!-- key: value --> comments. Blank
//      lines and complete-but-unrecognised comment blocks (e.g. deck-prep
//      prose pasted above `pos`) are skipped rather than ending the run.
//   6. strip any remaining complete <!-- ... --> block from the body — an
//      unrecognised or mid-body comment is never meant for the audience and
//      must never reach the rendered slide, escaped or not
//   7. hand the remaining body to the existing renderMarkdown()
//
// Steps 2 and 3 must precede step 5, and this is load-bearing rather than
// stylistic: markdown.js `HR` matches `---` and would emit an <hr>, and its
// fence info-string capture is a single token (`([A-Za-z0-9_+-]*)\s*$`) so
// "```css theme" does not match a fence at all and would fall through as a
// paragraph of raw CSS. Both are only harmless because this file removes them
// first; test/talks-parse.test.mjs pins that.
//
// Frontmatter is a deliberately small YAML subset — `key: value` scalars and
// `- item` lists, no nesting, no dependency. Anything else is a thrown Error
// rather than a silent misparse, matching the validator in
// .claude/skills/writing-slidecard-talks/validate.mjs.

import { renderMarkdown } from "../blog/markdown.js";

const DECK_KEYS = new Set(["title", "date", "venue", "summary", "fonts"]);
const SLIDE_KEYS = new Set(["pos", "kicker", "id", "covers", "goal"]);

// Per design §10: fonts entries are URL-encoded per family when the <link> is
// built, but the raw value is still constrained so a deck cannot smuggle a
// path or a query separator into the Google Fonts URL.
const FONT_RE = /^[A-Za-z0-9+:;@,._-]+$/;

const FM_KEY = /^[A-Za-z][A-Za-z0-9_]*$/;
const FM_ITEM = /^\s*-\s+(.*)$/;
const SLIDE_META = /^<!--\s*([a-z][a-z0-9_]*)\s*:\s*(.*?)\s*-->$/;
// Bare marker (no `key: value`) for relative positioning (§ derived mode):
// this slide is vertical, one step down in the same column as the slide
// before it. Sits among the other leading slide comments, in any order.
const DOWN_MARKER = /^<!--\s*down\s*-->$/;
const THEME_FENCE = /^```css theme\n([\s\S]*?)\n```$/m;
const TALK_FENCE = /^```talk\n([\s\S]*?)\n```$/m;
// Ids are opaque strings matching [A-Z][0-9]+[a-z]? (design §3): "P1a" is legal.
const PROMPT_LINE = /^(P[0-9]+[a-z]?)\s+(.+)$/;
const OUTLINE_LINE = /^(O[0-9]+[a-z]?)\s*\[\s*([^\]]*?)\s*\]\s*(.+)$/;
const SLIDE_SEP = /^---$/m;
const POS = /^(-?\d+)\s*,\s*(-?\d+)$/;
// "note" and "notes" are both accepted, colon optional, per the owner's
// actual usage — see the parse.js header note on defect history.
const NOTES_SINGLE = /^<!--\s*notes?\s*:?\s*(.*?)\s*-->$/;
const NOTES_MULTI_START = /^<!--\s*notes?\s*:?\s*$/;
const NOTES_END = /^-->$/;
// Any complete HTML comment, greedy across lines but non-greedy per block, so
// two separate stray comments in one body don't merge into one match.
const ANY_COMMENT = /<!--[\s\S]*?-->/g;

/**
 * Parse a deck source file.
 *
 * @param {string} src raw deck markdown
 * @returns {{ meta: object, theme: string|null, talk: object|null, slides: object[] }}
 * @throws {Error} on any validation failure (§10)
 */
export function parseDeck(src) {
  const text = normalise(src);
  const { meta, rest } = takeFrontmatter(text);
  const { theme, rest: afterTheme } = takeTheme(rest);
  const { talk, rest: body } = takeTalk(afterTheme);
  return { meta, theme, talk, slides: splitSlides(body, talk) };
}

/**
 * Frontmatter only — what the index needs, without rendering any markdown.
 *
 * @param {string} src raw deck markdown
 * @returns {object} the same `meta` shape parseDeck returns
 */
export function parseDeckMeta(src) {
  return takeFrontmatter(normalise(src)).meta;
}

function normalise(src) {
  return String(src ?? "").replace(/\r\n?/g, "\n");
}

// --- step 1: deck frontmatter -------------------------------------------------

function takeFrontmatter(text) {
  if (!text.startsWith("---\n")) {
    // No frontmatter block at all: `title` is required, so this always fails,
    // but it fails with the reason the author needs rather than "missing key".
    throw new Error("no deck frontmatter: the file must start with ---");
  }

  let end = text.indexOf("\n---\n", 3);
  let rest;
  if (end === -1) {
    if (text.endsWith("\n---")) {
      end = text.length - 4;
      rest = "";
    } else {
      throw new Error("frontmatter opened with --- but never closed");
    }
  } else {
    rest = text.slice(end + 5);
  }

  return { meta: buildMeta(parseFrontmatter(text.slice(4, end))), rest };
}

function parseFrontmatter(text) {
  const out = new Map();
  let key = null;

  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;

    const item = FM_ITEM.exec(raw);
    if (item) {
      if (!key) throw new Error(`frontmatter list item with no key: ${raw.trim()}`);
      const cur = out.get(key);
      // An empty value opened the list; a scalar followed by items is a typo.
      if (cur === "") out.set(key, []);
      else if (!Array.isArray(cur)) {
        throw new Error(`frontmatter key "${key}" has both a value and list items`);
      }
      out.get(key).push(item[1].trim());
      continue;
    }

    // "A value MAY contain a colon" — split on the first one, keep the rest.
    const colon = raw.indexOf(":");
    if (colon === -1) throw new Error(`frontmatter line is not "key: value": ${raw.trim()}`);
    const name = raw.slice(0, colon);
    if (!FM_KEY.test(name)) {
      throw new Error(`frontmatter line is not "key: value": ${raw.trim()}`);
    }
    key = name;
    if (out.has(key)) throw new Error(`duplicate frontmatter key: ${key}`);
    // An empty value opens a list; a non-empty one is a scalar, verbatim.
    out.set(key, raw.slice(colon + 1).trim());
  }

  return out;
}

function buildMeta(fields) {
  for (const key of fields.keys()) {
    if (!DECK_KEYS.has(key)) throw new Error(`unknown deck key: ${key}`);
  }

  for (const key of ["title", "date", "venue", "summary"]) {
    const v = fields.get(key);
    if (Array.isArray(v) && v.length) {
      throw new Error(`deck key "${key}" must be a single value, not a list`);
    }
  }

  const title = scalar(fields.get("title"));
  if (!title) throw new Error("frontmatter is missing required key: title");

  const raw = fields.get("fonts");
  const fonts = raw === undefined ? [] : Array.isArray(raw) ? raw : raw === "" ? [] : [raw];
  for (const f of fonts) {
    if (!FONT_RE.test(f)) throw new Error(`font entry fails validation: ${f}`);
  }

  const meta = { title, fonts };
  for (const key of ["date", "venue", "summary"]) {
    const v = scalar(fields.get(key));
    if (v) meta[key] = v;
  }
  return meta;
}

function scalar(v) {
  if (v === undefined) return "";
  return Array.isArray(v) ? "" : v;
}

// --- step 2: the theme fence --------------------------------------------------

function takeTheme(text) {
  const m = THEME_FENCE.exec(text);
  if (!m) return { theme: null, rest: text };
  // Only the first fence is the theme. Remove it so it can never reach
  // renderMarkdown, which would render it as a paragraph of raw CSS.
  const rest = text.slice(0, m.index) + text.slice(m.index + m[0].length);
  return { theme: escapeStyle(m[1]), rest };
}

// The block is injected into a <style> element unscoped (design §9). The
// validator already rejects a deck containing "</style", so this is the second
// line of defence rather than the first.
function escapeStyle(css) {
  return css.replace(/<\/(style)/gi, "<\\/$1");
}

// --- the ```talk fence (design §3) --------------------------------------------
//
// Extracted the same way as the theme fence: found, parsed, and removed from
// the source before slide splitting ever sees it. A deck with no fence at all
// is valid — `talk` is null and slides may not set `covers`.

function takeTalk(text) {
  const m = TALK_FENCE.exec(text);
  if (!m) return { talk: null, rest: text };
  const rest = text.slice(0, m.index) + text.slice(m.index + m[0].length);
  return { talk: parseTalkBlock(m[1]), rest };
}

function parseTalkBlock(content) {
  const prompt = [];
  const outline = [];
  const promptIds = new Set();
  const outlineIds = new Set();

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const om = OUTLINE_LINE.exec(line);
    if (om) {
      const [, id, coversRaw, oText] = om;
      if (outlineIds.has(id)) throw new Error(`talk fence: duplicate outline id: ${id}`);
      outlineIds.add(id);
      const covers = coversRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      outline.push({ id, covers, text: oText.trim() });
      continue;
    }

    const pm = PROMPT_LINE.exec(line);
    if (pm) {
      const [, id, pText] = pm;
      if (promptIds.has(id)) throw new Error(`talk fence: duplicate prompt id: ${id}`);
      promptIds.add(id);
      prompt.push({ id, text: pText.trim() });
      continue;
    }

    throw new Error(`talk fence: unrecognised line: ${raw}`);
  }

  for (const item of outline) {
    for (const pid of item.covers) {
      if (!promptIds.has(pid)) {
        throw new Error(`talk fence: outline item ${item.id} references unknown prompt id: ${pid}`);
      }
    }
  }

  return { prompt, outline };
}

// --- steps 3 and 4: slides ----------------------------------------------------

function splitSlides(text, talk) {
  const outlineIds = new Set(talk ? talk.outline.map((o) => o.id) : []);
  const chunks = text
    .split(SLIDE_SEP)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!chunks.length) throw new Error("no slides found");

  const parsedChunks = chunks.map((chunk, i) => {
    const { notes: rawNotes, rest: withoutNotes } = extractNotes(chunk);
    const { fields, down, body } = takeSlideMeta(withoutNotes);
    const label = `slide ${i + 1}${fields.kicker ? ` (${fields.kicker})` : ""}`;
    return { fields, down, body, rawNotes, label };
  });

  // Deck mode is decided once, by the first slide (§3): if it sets an
  // explicit pos, the whole deck is explicit-mode and behaves exactly as
  // before; otherwise the deck is derived-mode, and coordinates are walked
  // from document order. A deck may not mix the two - silent mixing would
  // produce a wrong map that still validates, so any slide that disagrees
  // with the mode slide 1 established throws, naming itself.
  const mode = parsedChunks[0].fields.pos !== undefined ? "explicit" : "derived";

  const seen = new Map();
  let prevPos = null;

  return parsedChunks.map(({ fields, down, body, rawNotes, label }, i) => {
    for (const key of Object.keys(fields)) {
      if (!SLIDE_KEYS.has(key)) throw new Error(`${label}: unknown slide key: ${key}`);
    }

    const hasExplicitPos = fields.pos !== undefined;
    if (hasExplicitPos !== (mode === "explicit")) {
      throw new Error(
        `${label}: this deck mixes explicit pos (set on slide 1) with derived positioning ` +
          `(<!-- down --> or a bare default) - a deck must use one or the other, never both`,
      );
    }

    let pos;
    if (mode === "explicit") {
      const m = POS.exec(fields.pos);
      if (!m) throw new Error(`${label}: pos must be two integers "x,y", got "${fields.pos}"`);
      pos = [Number(m[1]), Number(m[2])];
    } else if (i === 0) {
      if (down) throw new Error(`${label}: the first slide cannot be marked down - there is nothing above it`);
      pos = [0, 0];
    } else if (down) {
      pos = [prevPos[0], prevPos[1] + 1];
    } else {
      pos = [prevPos[0] + 1, 0];
    }
    prevPos = pos;

    const key = pos.join(",");
    if (seen.has(key)) {
      throw new Error(`${label}: duplicate pos ${key}, already used by ${seen.get(key)}`);
    }
    seen.set(key, label);

    const covers = fields.covers
      ? fields.covers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (covers.length && !talk) {
      throw new Error(`${label}: covers set but deck has no talk fence`);
    }
    for (const oid of covers) {
      if (!outlineIds.has(oid)) {
        throw new Error(`${label}: covers references unknown outline id: ${oid}`);
      }
    }

    return {
      pos,
      kicker: fields.kicker ?? null,
      id: fields.id ?? null,
      html: renderMarkdown(stripComments(body)),
      notes: rawNotes === null ? null : renderMarkdown(rawNotes),
      covers,
      goal: fields.goal ?? null,
    };
  });
}

// The leading metadata run tolerates two things besides `key: value`
// comments, and keeps scanning past them rather than stopping: a blank line,
// and a complete-but-unrecognised HTML comment block (single- or
// multi-line) such as deck-prep prose pasted above `pos`. Without this, that
// comment silently ends the run before `pos` is ever seen (the bug that took
// a real deck down). Anything else — the first real content line — ends the
// run, same as before.
function takeSlideMeta(chunk) {
  const lines = chunk.split("\n");
  const fields = {};
  let down = false;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (DOWN_MARKER.test(line.trim())) {
      down = true;
      i++;
      continue;
    }
    const m = SLIDE_META.exec(line);
    if (m) {
      fields[m[1]] = m[2];
      i++;
      continue;
    }
    if (line.trimStart().startsWith("<!--")) {
      const end = findCommentEnd(lines, i);
      if (end !== -1) {
        i = end + 1;
        continue;
      }
    }
    break;
  }
  return { fields, down, body: lines.slice(i).join("\n").trim() };
}

// Index of the line (from `from`, inclusive) that contains the closing
// `-->` for a comment opened at `from`, or -1 if none of the remaining lines
// close it.
function findCommentEnd(lines, from) {
  for (let j = from; j < lines.length; j++) {
    if (lines[j].includes("-->")) return j;
  }
  return -1;
}

// Strip every complete `<!-- ... -->` block left in a slide body once
// metadata and notes have already been pulled out. Nothing that reaches this
// point is meant for the audience — it either failed to match a known
// marker or was deliberately mid-body deck prep — so it is removed rather
// than rendered, escaped or not (design requirement: no HTML comment may
// ever reach the rendered slide).
function stripComments(body) {
  return body.replace(ANY_COMMENT, "").trim();
}

// Notes may appear anywhere in the slide body (leading run or mid-body), as
// either a single-line `<!-- notes: ... -->` comment or a multi-line block
// running from a line matching `<!-- notes:` to a line that is exactly
// `-->`. Pulled out before takeSlideMeta ever sees the chunk so it never
// disrupts the leading pos/kicker/id run, and never reaches renderMarkdown
// as part of the visible body.
function extractNotes(chunk) {
  const lines = chunk.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const single = NOTES_SINGLE.exec(lines[i]);
    if (single) {
      const rest = [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n");
      return { notes: single[1], rest };
    }
    if (NOTES_MULTI_START.test(lines[i])) {
      let end = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (NOTES_END.test(lines[j])) {
          end = j;
          break;
        }
      }
      if (end === -1) {
        throw new Error("notes block opened with <!-- notes: but never closed with -->");
      }
      const content = lines.slice(i + 1, end).join("\n");
      const rest = [...lines.slice(0, i), ...lines.slice(end + 1)].join("\n");
      return { notes: content, rest };
    }
  }
  return { notes: null, rest: chunk };
}
