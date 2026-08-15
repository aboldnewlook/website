// Blog templates. Same shell, same type scale, same rule-under-the-title motif
// as the résumé — a blog attached to a résumé, not a second website.

import { escapeHtml, formatDate, isoDate } from "../format.js";
import { renderMarkdown } from "../blog/markdown.js";
import { layout } from "./layout.js";

const e = escapeHtml;

function time(raw) {
  const iso = isoDate(raw);
  const human = formatDate(raw);
  if (!human) return "";
  return `<time datetime="${e(iso)}">${e(human)}</time>`;
}

function tagLine(tags) {
  if (!tags.length) return "";
  return `<span class="tags">${tags.map((t) => e(t.label)).join(", ")}</span>`;
}

/** GET /blog — the index. Renders an honest empty state when there is nothing. */
export function renderBlogIndex(posts) {
  const body = posts.length ? postList(posts) : emptyState();
  return layout({
    title: "Blog — Ryan Schumacher",
    description: "Writing by Ryan Schumacher.",
    current: "blog",
    body: `<h1 class="page-title">Blog</h1>
<p class="page-lede">Notes on building things, and on working with the machines that help build them.</p>
${body}`,
  });
}

function postList(posts) {
  const items = posts
    .map((p) => {
      const living = p.finalized_at ? "" : `<span class="badge">Living</span>`;
      const meta = [time(p.went_live_at), tagLine(p.tags), living]
        .filter(Boolean)
        .join("");
      return `<li>
      <h2 class="post-title"><a href="/blog/${encodeURIComponent(p.slug)}">${e(p.title)}</a></h2>
      <p class="post-meta">${meta}</p>
      ${p.summary ? `<p class="post-summary">${e(p.summary)}</p>` : ""}
    </li>`;
    })
    .join("");
  return `<ul class="postlist">${items}</ul>`;
}

function emptyState() {
  return `<div class="empty">
    <p>No posts yet.</p>
    <p>The first one will appear here when it is ready.</p>
  </div>`;
}

/** GET /blog/:slug — one post. */
export function renderPost(post) {
  const living = !post.finalized_at;
  const meta = [
    post.went_live_at ? `Published ${time(post.went_live_at)}` : "",
    tagLine(post.tags),
    living ? `<span class="badge">Living</span>` : "",
  ]
    .filter(Boolean)
    .join("");

  const livingNote = living
    ? `<p class="living-note">This is a living post — it is still being revised. Changes worth knowing about are listed at the end.</p>`
    : "";

  return layout({
    title: `${post.title} — Ryan Schumacher`,
    description: post.summary || undefined,
    current: "blog",
    body: `<article>
  <header class="post-header">
    <h1 class="page-title">${e(post.title)}</h1>
    ${post.summary ? `<p class="post-deck">${e(post.summary)}</p>` : ""}
    <p class="post-meta">${meta}</p>
    ${livingNote}
  </header>
  <div class="prose">
${renderMarkdown(post.body)}
  </div>
  ${revisionsSection(post.revisions)}
</article>
<p class="backlink"><a href="/blog">← All posts</a></p>`,
  });
}

/**
 * The revisions list is the whole point of the living-post model: a reader who
 * already read this post should be able to see what changed since. Rendered
 * newest-first, and omitted entirely when there is nothing to say.
 */
function revisionsSection(revisions) {
  if (!revisions || !revisions.length) return "";
  const items = revisions
    .map(
      (r) =>
        `<li><span class="when">${time(r.created_at)}</span>${e(r.note)}</li>`,
    )
    .join("");
  return `<section class="revisions">
    <h2 class="section-title">Updated</h2>
    <ol>${items}</ol>
  </section>`;
}
