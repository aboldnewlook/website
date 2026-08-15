// A small, self-contained Markdown renderer.
//
// Why not a library: the Worker has no build step, and every maintained
// markdown package is either CommonJS-shaped or drags in a plugin ecosystem
// for features a personal blog does not use. This covers the subset the author
// actually writes — headings, paragraphs, lists, blockquotes, fenced and inline
// code, links, images, rules, simple tables, emphasis — and nothing else.
//
// Safety posture: input is escaped FIRST, and HTML is then produced only by
// this file. Raw HTML in the source is therefore shown as text rather than
// executed. The body is owner-authored and trusted, but "trusted" is not a
// reason to build an XSS hole, and link hrefs are scheme-checked regardless.

import { escapeHtml } from "../format.js";

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const UL = /^(\s*)[-*+][ \t]+(.*)$/;
const OL = /^(\s*)\d{1,9}[.)][ \t]+(.*)$/;
const TABLE_DELIM = /^ {0,3}\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;

/** Render a markdown document to an HTML fragment. */
export function renderMarkdown(src) {
  const text = String(src ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "    ");
  return renderBlocks(text.split("\n"));
}

// --- block level --------------------------------------------------------------

function indentOf(line) {
  return line.length - line.replace(/^\s*/, "").length;
}

function matchItem(line) {
  let m = UL.exec(line);
  if (m) return { ordered: false, indent: m[1].length, content: m[2] };
  m = OL.exec(line);
  if (m) return { ordered: true, indent: m[1].length, content: m[2] };
  return null;
}

function renderBlocks(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const len = fence[1].length;
      const lang = fence[2];
      const body = [];
      i++;
      while (i < lines.length) {
        const close = FENCE.exec(lines[i]);
        if (close && close[1][0] === marker && close[1].length >= len) {
          i++;
          break;
        }
        body.push(lines[i]);
        i++;
      }
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(body.join("\n"))}\n</code></pre>`);
      continue;
    }

    if (HR.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      // The page already owns the <h1>; shift document headings down one level.
      const level = Math.min(heading[1].length + 1, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const body = [];
      while (i < lines.length) {
        const m = QUOTE.exec(lines[i]);
        if (m) {
          body.push(m[1]);
          i++;
        } else if (lines[i].trim() && body.length) {
          body.push(lines[i]); // lazy continuation
          i++;
        } else break;
      }
      out.push(`<blockquote>${renderBlocks(body)}</blockquote>`);
      continue;
    }

    if (matchItem(line)) {
      const list = collectList(lines, i);
      out.push(renderList(list));
      i = list.next;
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_DELIM.test(lines[i + 1])) {
      const table = collectTable(lines, i);
      out.push(table.html);
      i = table.next;
      continue;
    }

    // Paragraph: run to the next blank line or block starter.
    const para = [];
    while (i < lines.length && lines[i].trim()) {
      const l = lines[i];
      if (HEADING.test(l) || HR.test(l) || FENCE.test(l) || QUOTE.test(l) || matchItem(l)) break;
      para.push(l.trim());
      i++;
    }
    if (para.length) out.push(`<p>${inline(para.join("\n"))}</p>`);
  }

  return out.join("\n");
}

function collectList(lines, start) {
  const first = matchItem(lines[start]);
  const ordered = first.ordered;
  const base = first.indent;
  const items = [];
  let cur = null;
  let loose = false;
  let i = start;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      let j = i;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j >= lines.length) {
        i = j;
        break;
      }
      const next = lines[j];
      const mn = matchItem(next);
      const continues = (mn && mn.indent >= base) || indentOf(next) > base;
      if (!continues) {
        i = j;
        break;
      }
      loose = true;
      if (cur) cur.push("");
      i = j;
      continue;
    }

    const mi = matchItem(line);
    if (mi && mi.indent <= base + 1) {
      if (mi.ordered !== ordered) break; // a different list starts here
      cur = [mi.content];
      items.push(cur);
      i++;
      continue;
    }

    if (indentOf(line) > base) {
      cur.push(line.slice(Math.min(indentOf(line), base + 2)));
      i++;
      continue;
    }

    if (cur) {
      cur.push(line.trim()); // lazy paragraph continuation
      i++;
      continue;
    }
    break;
  }

  return { items, ordered, loose, next: i };
}

function renderList({ items, ordered, loose }) {
  const tag = ordered ? "ol" : "ul";
  const body = items
    .map((item) => {
      let html = renderBlocks(item);
      if (!loose) {
        // Tight list: unwrap the leading paragraph so <li> holds the text
        // directly, leaving any nested list that follows it alone.
        const lead = /^<p>([\s\S]*?)<\/p>(\n[\s\S]*)?$/.exec(html);
        if (lead && !lead[1].includes("<p>")) html = lead[1] + (lead[2] ?? "");
      }
      return `<li>${html}</li>`;
    })
    .join("");
  return `<${tag}>${body}</${tag}>`;
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function collectTable(lines, start) {
  const head = splitRow(lines[start]);
  let i = start + 2;
  const rows = [];
  while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
    rows.push(splitRow(lines[i]));
    i++;
  }
  const thead = `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
  const tbody = rows.length
    ? `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`
    : "";
  return { html: `<table>${thead}${tbody}</table>`, next: i };
}

// --- inline level -------------------------------------------------------------

const SENTINEL = "\u0000";

/** Reject any scheme that is not http(s) or mailto; leave relative URLs alone. */
function safeUrl(raw) {
  const t = String(raw).trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) {
    return /^(https?|mailto):/i.test(t) ? t : "#";
  }
  return t;
}

function inline(raw) {
  // Escape first: from here on, every angle bracket in the string is ours.
  let s = escapeHtml(String(raw).replace(/\u0000/g, ""));

  // Pull code spans out so emphasis and links cannot reach inside them.
  const codes = [];
  s = s.replace(/(`+)([\s\S]*?)\1/g, (_, _ticks, body) => {
    codes.push(`<code>${body.replace(/^ | $/g, "")}</code>`);
    return `${SENTINEL}${codes.length - 1}${SENTINEL}`;
  });

  // Images before links — ![alt](src) would otherwise match the link rule.
  s = s.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, title) => {
    const t = title ? ` title="${title}"` : "";
    return `<img src="${safeUrl(src)}" alt="${alt}"${t} loading="lazy">`;
  });

  s = s.replace(/\[([^\]]+)\]\(([^\s)]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, text, href, title) => {
    const t = title ? ` title="${title}"` : "";
    return `<a href="${safeUrl(href)}"${t}>${text}</a>`;
  });

  // Bare autolinks: <https://example.com> survives escaping as &lt;...&gt;.
  s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, (_, url) => `<a href="${url}">${url}</a>`);

  s = s.replace(/\*\*([^\s*](?:[\s\S]*?[^\s*])?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^\s_](?:[\s\S]*?[^\s_])?)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^\s*](?:[\s\S]*?[^\s*])?)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^\w_])_([^\s_](?:[\s\S]*?[^\s_])?)_(?![\w_])/g, "$1<em>$2</em>");
  s = s.replace(/~~([\s\S]+?)~~/g, "<del>$1</del>");

  // Hard break: two trailing spaces, then a newline.
  s = s.replace(/ {2,}\n/g, "<br>\n");

  return s.replace(new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g"), (_, n) => codes[Number(n)]);
}
