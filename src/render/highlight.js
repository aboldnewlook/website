// A very small syntax highlighter for slide code samples.
//
// Why not a library: same reason as src/blog/markdown.js. The Worker has no
// build step, Shiki and Prism both want one (or a CDN fetch, which a deck
// presented on a conference network cannot rely on), and a deck only needs
// enough colour to make shape legible from the back of a room. This is not a
// parser and does not try to be: it colours comments, strings, numbers,
// keywords, types and call sites, and gets everything else wrong silently.
//
// SAFETY. This runs on text that markdown.js has ALREADY escaped, and it only
// ever inserts <span> tags of its own making. It never unescapes, never emits
// anything derived from input, and treats an HTML entity as one opaque atom so
// a span can never be inserted into the middle of `&amp;`. The escape-first
// posture of markdown.js is preserved exactly.

/** Entities markdown.js can produce. Matched as single atoms, never split. */
const ENTITY = "&(?:amp|lt|gt|quot|#39);";

const KEYWORDS = {
  common:
    "as async await break case catch class const continue default defer do else enum export extends " +
    "extern false final finally for from func function go if implements import in instanceof interface " +
    "let map match mod move mut new nil null package private protected public range return select self " +
    "static struct super switch this throw throws true try type typeof use var void where while yield",
  go: "chan fallthrough goto rune string int int8 int16 int32 int64 uint uintptr byte bool error float32 float64",
  java: "abstract boolean byte char double float instanceof int long native short synchronized transient volatile",
  ts: "any bigint boolean declare infer is keyof namespace never number object readonly string symbol undefined unknown",
  rust: "crate dyn fn impl loop pub ref trait unsafe usize u8 u16 u32 u64 i8 i16 i32 i64 f32 f64",
  py: "and def del elif except from global lambda none not or pass raise with True False None",
  sh: "echo cd export local read set source then fi esac done",
};

const ALIAS = {
  javascript: "js",
  typescript: "ts",
  tsx: "ts",
  jsx: "js",
  golang: "go",
  rs: "rust",
  python: "py",
  bash: "sh",
  shell: "sh",
  zsh: "sh",
  console: "sh",
  yml: "yaml",
};

/** Languages whose comments start with # rather than //. */
const HASH_COMMENT = new Set(["sh", "py", "yaml", "toml", "ruby", "rb", "makefile"]);

function keywordSet(lang) {
  const extra = KEYWORDS[lang] ?? "";
  return new Set(`${KEYWORDS.common} ${extra}`.split(/\s+/).filter(Boolean));
}

/**
 * Highlight one already-escaped code string.
 *
 * @param {string} escaped code as markdown.js escaped it
 * @param {string|null} lang info-string from the fence, or null
 * @returns {string} HTML with <span class="tok-*"> wrappers
 */
export function highlight(escaped, lang) {
  const key = ALIAS[(lang ?? "").toLowerCase()] ?? (lang ?? "").toLowerCase();
  const keywords = keywordSet(key);
  const hash = HASH_COMMENT.has(key);

  // One left-to-right scan. Order is the precedence: a keyword inside a string
  // must stay a string, so strings and comments come first. `&(?:...);` guards
  // every alternative that could otherwise step into an entity.
  const line = hash ? "#[^\\n]*" : "\\/\\/[^\\n]*";
  const RE = new RegExp(
    [
      `(?<comment>${line}|\\/\\*[\\s\\S]*?\\*\\/)`,
      `(?<string>&quot;(?:[^&\\n]|${ENTITY})*?&quot;|&#39;(?:[^&\\n]|${ENTITY})*?&#39;|\`(?:[^\`])*?\`)`,
      "(?<number>\\b\\d[\\d_]*(?:\\.\\d+)?\\b)",
      "(?<fn>\\b[A-Za-z_$][\\w$]*(?=\\())",
      "(?<type>\\b[A-Z][\\w$]*\\b)",
      "(?<word>\\b[A-Za-z_$][\\w$]*\\b)",
      `(?<entity>${ENTITY})`,
    ].join("|"),
    "g",
  );

  let out = "";
  let last = 0;
  for (const m of escaped.matchAll(RE)) {
    const g = m.groups;
    out += escaped.slice(last, m.index);
    last = m.index + m[0].length;

    if (g.comment) out += span("comment", m[0]);
    else if (g.string) out += span("string", m[0]);
    else if (g.number) out += span("number", m[0]);
    else if (g.word && keywords.has(m[0])) out += span("keyword", m[0]);
    else if (g.fn) out += keywords.has(m[0]) ? span("keyword", m[0]) : span("fn", m[0]);
    else if (g.type) out += span("type", m[0]);
    else out += m[0];
  }
  return out + escaped.slice(last);
}

function span(cls, text) {
  return `<span class="tok-${cls}">${text}</span>`;
}

/**
 * Rewrite every <pre><code class="language-x"> block in a rendered HTML
 * fragment, leaving everything else byte-identical. A block with no language
 * is left alone: guessing produces confident nonsense.
 */
export function highlightBlocks(html) {
  return html.replace(
    /<pre><code class="language-([A-Za-z0-9_+-]+)">([\s\S]*?)<\/code><\/pre>/g,
    (whole, lang, body) =>
      `<pre><code class="language-${lang}">${highlight(body, lang)}</code></pre>`,
  );
}
