// GET /blog        — index of live posts, newest first.
// GET /blog/:slug   — one live post.

import { listPosts, getPost } from "../blog/db.js";
import { renderBlogIndex, renderPost } from "../render/blog.js";

const HTML = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "public, max-age=300",
};

export async function handleBlogIndex(request, env) {
  const posts = await listPosts(env.BLOG);
  return new Response(renderBlogIndex(posts), { headers: HTML });
}

/** Returns null when the slug is not a live post; the router turns that into a 404. */
export async function handleBlogPost(request, env, slug) {
  const post = await getPost(env.BLOG, slug);
  if (!post) return null;
  return new Response(renderPost(post), { headers: HTML });
}
