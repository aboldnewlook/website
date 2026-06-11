# aboldnewlook.com

Personal website for Ryan Schumacher. Built with Astro, Tailwind CSS v4, and MDX.

## Development

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # Build to ./dist/
npm run preview  # Preview the build
```

## Adding blog posts

Create a new `.mdx` file in `src/content/blog/`:

```mdx
---
title: "Post Title"
description: "A short description."
date: 2026-03-15
tags: ["tag"]
---

Your content here.
```
