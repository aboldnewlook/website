// Slidecard deck parser: deck markdown -> { meta, theme, slides[] }.
//
// The parse order is strict and each step consumes its input before the next
// step sees it (design §7):
//
//   1. deck frontmatter, only if the file starts with `---`
//   2. the first ```css theme fence, removed from the source
//   3. split what remains on /^---$/m into slides
//   4. per slide, consume the leading <!-- key: value --> comments
//   5. hand the remaining body to the existing renderMarkdown()
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
const SLIDE_KEYS = new Set(["pos", "kicker", "id"]);

// Per design §10: fonts entries are URL-encoded per family when the <link> is
// built, but the raw value is still constrained so a deck cannot smuggle a
// path or a query separator into the Google Fonts URL.
const FONT_RE = /^[A-Za-z0-9+:;@,._-]+$/;

const FM_KEY = /^[A-Za-z][A-Za-z0-9_]*$/;
const FM_ITEM = /^\s*-\s+(.*)$/;
const SLIDE_META = /^<!--\s*([a-z][a-z0-9_]*)\s*:\s*(.*?)\s*-->$/;
const THEME_FENCE = /^```css theme\n([\s\S]*?)\n```$/m;
const SLIDE_SEP = /^---$/m;
const POS = /^(-?\d+)\s*,\s*(-?\d+)$/;

/**
 * Parse a deck source file.
 *
 * @param {string} src raw deck markdown
 * @returns {{ meta: object, theme: string|null, slides: object[] }}
 * @throws {Error} on any validation failure (§10)
 */
export function parseDeck(src) {
  const text = normalise(src);
  const { meta, rest } = takeFrontmatter(text);
  const { theme, rest: body } = takeTheme(rest);
  return { meta, theme, slides: splitSlides(body) };
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

// --- steps 3 and 4: slides ----------------------------------------------------

function splitSlides(text) {
  const chunks = text
    .split(SLIDE_SEP)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!chunks.length) throw new Error("no slides found");

  const seen = new Map();
  return chunks.map((chunk, i) => {
    const { fields, body } = takeSlideMeta(chunk);
    const label = `slide ${i + 1}${fields.kicker ? ` (${fields.kicker})` : ""}`;

    for (const key of Object.keys(fields)) {
      if (!SLIDE_KEYS.has(key)) throw new Error(`${label}: unknown slide key: ${key}`);
    }

    if (!fields.pos) throw new Error(`${label}: missing required pos`);
    const m = POS.exec(fields.pos);
    if (!m) throw new Error(`${label}: pos must be two integers "x,y", got "${fields.pos}"`);
    const pos = [Number(m[1]), Number(m[2])];

    const key = pos.join(",");
    if (seen.has(key)) {
      throw new Error(`${label}: duplicate pos ${key}, already used by ${seen.get(key)}`);
    }
    seen.set(key, label);

    return {
      pos,
      kicker: fields.kicker ?? null,
      id: fields.id ?? null,
      html: renderMarkdown(body),
    };
  });
}

function takeSlideMeta(chunk) {
  const lines = chunk.split("\n");
  const fields = {};
  let i = 0;
  for (; i < lines.length; i++) {
    const m = SLIDE_META.exec(lines[i]);
    if (!m) break; // metadata is a leading run; the first other line ends it
    fields[m[1]] = m[2];
  }
  return { fields, body: lines.slice(i).join("\n").trim() };
}
