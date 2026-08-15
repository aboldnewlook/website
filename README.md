# aboldnewlook.com

The public site: Ryan Schumacher's résumé on the homepage, and a blog.

One Cloudflare Worker. Server-rendered HTML, no framework, no build step, no
client JavaScript. `wrangler deploy` is the whole pipeline.

## Routes

| Route         | What it is                                              |
| ------------- | ------------------------------------------------------- |
| `/`           | The résumé, assembled from D1 for `DEFAULT_TARGET`      |
| `/blog`       | Index of live posts, newest first                        |
| `/blog/:slug` | One post, markdown rendered to HTML                      |
| `/resume.txt` | The same résumé as plain text (the LinkedIn-paste copy)  |

Anything else is a 404. Anything that is not `GET`/`HEAD` is a 405.

## Data

Two D1 bindings, both read-only from this Worker:

- **`RESUME` → `resume-public`** (`e82ee3ed-53a8-4273-b98b-479ac30896fd`)
  The public résumé tables — `profile`, `companies`, `roles`,
  `accomplishments`, `targets` — split out of the `resume-backlog` database
  that the private [resume Worker](https://github.com/jrschumacher/resume)
  uses. That database also holds job-hunt data; the split exists so this Worker
  has no binding that could reach it.
  `db/0001_seed_public_resume.sql` is the one-time copy that seeded it.

- **`BLOG` → `personal-blog`** (`2aec93a1-cc30-4480-b3e7-31611f15f2bf`)
  The published shelf, written by a Cairn publish step. A post is visible here
  only when `went_live_at IS NOT NULL AND archived = 0`.

A post with `finalized_at` still NULL is a *living* post: it is marked as such,
and its `revisions` notes are listed at the end of the page so a returning
reader can see what changed.

## Résumé assembly

`src/scope.js`, `src/format.js`, `src/render/{html,text,css}.js` are ported from
`jrschumacher/resume` — same scoring algorithm, same markup, same stylesheet.
A *target* (a role archetype such as `principal-security`) supplies the
headline, summary, and the include/boost/exclude tag rules that decide which
accomplishments appear and in what order. The homepage renders one target,
named in `src/config.js`:

```js
export const DEFAULT_TARGET = "principal-security";
```

Change that string to re-point the homepage.

## Develop

```sh
npm install
npm run dev
npm test          # markdown renderer unit tests
npm run deploy
```

## Custom domain

Not attached. `aboldnewlook.com` is still on Google Domains nameservers
(`ns-cloud-*.googledomains.com`), so it is not a Cloudflare zone and a Worker
custom domain cannot be created for it. Move the nameservers to Cloudflare
first; then add a `routes` / `custom_domain` entry to `wrangler.toml`.
