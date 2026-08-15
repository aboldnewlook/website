// aboldnewlook.com — one Worker, two D1 bindings, no build step, no client JS.
//
//   RESUME -> resume-public   (profile, companies, roles, accomplishments, targets)
//   BLOG   -> personal-blog   (posts, revisions, tags, post_tags, source_ideas)
//
// Everything here is a public GET. There is no write path and no auth, by
// design: the private job-pipeline data lives in a different database that this
// Worker has no binding to and therefore cannot reach.

import { handleResumeHtml, handleResumeText } from "./routes/resume.js";
import { handleBlogIndex, handleBlogPost } from "./routes/blog.js";
import { layout } from "./render/layout.js";

function plain(body, status) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function notFound() {
  return new Response(
    layout({
      title: "Not found — Ryan Schumacher",
      body: `<h1 class="page-title">Not found</h1>
<p class="page-lede">There is nothing at this address.</p>
<div class="empty"><p><a href="/">Résumé</a> · <a href="/blog">Blog</a></p></div>`,
    }),
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

/** Strip a trailing slash so /blog/ and /blog are the same page. */
function normalize(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export default {
  async fetch(request, env) {
    const method = request.method;
    if (method !== "GET" && method !== "HEAD") {
      return new Response("Method not allowed\n", {
        status: 405,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          allow: "GET, HEAD",
        },
      });
    }

    const path = normalize(new URL(request.url).pathname);

    try {
      let response;
      if (path === "/") {
        response = await handleResumeHtml(request, env);
      } else if (path === "/resume.txt") {
        response = await handleResumeText(request, env);
      } else if (path === "/blog") {
        response = await handleBlogIndex(request, env);
      } else if (path.startsWith("/blog/")) {
        const slug = decodeURIComponent(path.slice("/blog/".length));
        response = slug ? await handleBlogPost(request, env, slug) : null;
      }

      if (!response) response = notFound();

      // HEAD is GET without the body; let the router stay body-shaped.
      if (method === "HEAD") {
        return new Response(null, {
          status: response.status,
          headers: response.headers,
        });
      }
      return response;
    } catch (err) {
      console.error(err);
      return plain(`Internal error: ${err?.message ?? err}\n`, 500);
    }
  },
};
