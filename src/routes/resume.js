// GET /           — the résumé, as HTML. The homepage.
// GET /resume.txt — the same résumé, as plain text.

import { DEFAULT_TARGET } from "../config.js";
import { getTarget, loadBacklog } from "../resume/db.js";
import { assemble } from "../scope.js";
import { renderHtml } from "../render/html.js";
import { renderText } from "../render/text.js";

async function build(env) {
  const target = await getTarget(env.RESUME, DEFAULT_TARGET);
  if (!target) {
    throw new Error(`Résumé target "${DEFAULT_TARGET}" is missing from resume-public`);
  }
  const data = await loadBacklog(env.RESUME);
  return assemble(target, data);
}

export async function handleResumeHtml(request, env) {
  const resume = await build(env);
  return new Response(renderHtml(resume), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

export async function handleResumeText(request, env) {
  const resume = await build(env);
  return new Response(renderText(resume), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
