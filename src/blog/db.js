// D1 read helpers for the published blog (binding: BLOG, database personal-blog).
//
// The site's only visibility predicate, from the schema's own comment:
//   went_live_at IS NOT NULL AND archived = 0
// It is spelled out in every query below rather than factored into a helper, so
// that no future query can accidentally be written without it.

const LIVE = "went_live_at IS NOT NULL AND archived = 0";

/** Live posts, newest first, with their tags attached. */
export async function listPosts(DB) {
  const [posts, tags] = await DB.batch([
    DB.prepare(
      `SELECT id, slug, title, summary, went_live_at, finalized_at
         FROM posts
        WHERE ${LIVE}
        ORDER BY went_live_at DESC, id DESC`,
    ),
    DB.prepare(
      `SELECT pt.post_id, t.key, t.label
         FROM post_tags pt
         JOIN tags t ON t.key = pt.tag
         JOIN posts p ON p.id = pt.post_id
        WHERE p.went_live_at IS NOT NULL AND p.archived = 0
        ORDER BY t.sort_order`,
    ),
  ]);

  const byPost = new Map();
  for (const row of tags.results ?? []) {
    if (!byPost.has(row.post_id)) byPost.set(row.post_id, []);
    byPost.get(row.post_id).push({ key: row.key, label: row.label });
  }

  return (posts.results ?? []).map((p) => ({ ...p, tags: byPost.get(p.id) ?? [] }));
}

/**
 * One live post by slug, with its reader-facing revision notes and tags.
 * Returns null when the slug is unknown, staged, or archived — the caller
 * cannot tell those apart, and should not be able to.
 */
export async function getPost(DB, slug) {
  const post = await DB.prepare(
    `SELECT id, slug, title, summary, body, went_live_at, finalized_at, updated_at
       FROM posts
      WHERE slug = ? AND ${LIVE}`,
  )
    .bind(slug)
    .first();
  if (!post) return null;

  const [revisions, tags] = await DB.batch([
    DB.prepare(
      `SELECT note, created_at FROM revisions
        WHERE post_id = ? ORDER BY created_at DESC, id DESC`,
    ).bind(post.id),
    DB.prepare(
      `SELECT t.key, t.label FROM post_tags pt
         JOIN tags t ON t.key = pt.tag
        WHERE pt.post_id = ? ORDER BY t.sort_order`,
    ).bind(post.id),
  ]);

  return {
    ...post,
    revisions: revisions.results ?? [],
    tags: tags.results ?? [],
  };
}
