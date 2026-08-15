import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "../src/blog/markdown.js";

test("headings shift down one level (the page owns the h1)", () => {
  assert.equal(renderMarkdown("# Title"), "<h2>Title</h2>");
  assert.equal(renderMarkdown("### Deep"), "<h4>Deep</h4>");
});

test("paragraphs and emphasis", () => {
  assert.equal(
    renderMarkdown("A **bold** and *italic* line."),
    "<p>A <strong>bold</strong> and <em>italic</em> line.</p>",
  );
});

test("tight list", () => {
  assert.equal(renderMarkdown("- one\n- two"), "<ul><li>one</li><li>two</li></ul>");
});

test("ordered list", () => {
  assert.equal(renderMarkdown("1. one\n2. two"), "<ol><li>one</li><li>two</li></ol>");
});

test("nested list", () => {
  assert.equal(
    renderMarkdown("- one\n  - inner\n- two"),
    "<ul><li>one\n<ul><li>inner</li></ul></li><li>two</li></ul>",
  );
});

test("fenced code is escaped, not executed", () => {
  assert.equal(
    renderMarkdown("```js\nconst a = 1 < 2;\n```"),
    '<pre><code class="language-js">const a = 1 &lt; 2;\n</code></pre>',
  );
});

test("inline code is not touched by emphasis rules", () => {
  assert.equal(renderMarkdown("`a * b * c`"), "<p><code>a * b * c</code></p>");
});

test("raw HTML in the source is shown, never injected", () => {
  assert.equal(
    renderMarkdown("<script>alert(1)</script>"),
    "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
  );
});

test("javascript: hrefs are defanged", () => {
  assert.equal(
    renderMarkdown("[x](javascript:alert)"),
    '<p><a href="#">x</a></p>',
  );
});

test("http links survive", () => {
  assert.equal(
    renderMarkdown("[x](https://example.com/a?b=1)"),
    '<p><a href="https://example.com/a?b=1">x</a></p>',
  );
});

test("blockquote", () => {
  assert.equal(renderMarkdown("> quoted"), "<blockquote><p>quoted</p></blockquote>");
});

test("horizontal rule", () => {
  assert.equal(renderMarkdown("---"), "<hr>");
});

test("empty input renders nothing", () => {
  assert.equal(renderMarkdown(""), "");
  assert.equal(renderMarkdown(null), "");
});
