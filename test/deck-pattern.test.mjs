// /deck/pattern.svg is the only route that reflects a query parameter into a
// response body, so it is tested as a hostile-input surface: escaping,
// clamping, rejection, headers (design §9.1, §11).

import { test } from "node:test";
import assert from "node:assert/strict";

import { patternSvgResponse } from "../src/render/talks.js";

function get(query = "") {
  return patternSvgResponse(new URL(`https://aboldnewlook.com/deck/pattern.svg${query}`));
}

async function body(query) {
  const res = get(query);
  return { res, text: await res.text() };
}

// --- defaults ------------------------------------------------------------------

test("defaults: 48px tile, 0.06 opacity, neutral fill", async () => {
  const { res, text } = await body("?g=%C2%A7");
  assert.equal(res.status, 200);
  assert.match(text, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="48" height="48"/);
  assert.match(text, /viewBox="0 0 48 48"/);
  assert.match(text, /opacity="0.06"/);
  assert.match(text, /fill="#808080"/);
  assert.match(text, />§<\/text>/);
});

test("the glyph is centred and scales with the tile", async () => {
  const { text } = await body("?g=x&size=100");
  assert.match(text, /width="100" height="100"/);
  assert.match(text, /x="50%" y="50%"/);
  assert.match(text, /text-anchor="middle"/);
  assert.match(text, /font-size="50"/);
});

// --- escaping ------------------------------------------------------------------

test("XML metacharacters in g are escaped, never reflected raw", async () => {
  const { res, text } = await body(`?g=${encodeURIComponent("<&'\">")}`);
  assert.equal(res.status, 200);
  assert.match(text, />&lt;&amp;&apos;&quot;&gt;<\/text>/);
  assert.ok(!text.includes("<&"), "no raw ampersand-angle sequence");
  assert.ok(!/<\/text>[^]*<\//.test(text.replace("</text></svg>", "")), "nothing after the text node");
});

test("a script payload in g cannot open an element", async () => {
  const { res, text } = await body(`?g=${encodeURIComponent("<script>")}`);
  assert.equal(res.status, 200);
  assert.ok(!text.includes("<script"), "the tag is escaped, not emitted");
  assert.match(text, /&lt;script&gt;/);
});

test("a hostile color cannot escape the fill attribute", async () => {
  const { res, text } = await body(`?g=x&color=${encodeURIComponent('#fff" onload="alert(1)')}`);
  assert.equal(res.status, 400);
  assert.ok(!text.includes("onload"), "the rejection does not reflect the input");
});

// --- clamping ------------------------------------------------------------------

test("size clamps to 8..256 rather than failing", async () => {
  assert.match((await body("?g=x&size=1")).text, /width="8" height="8"/);
  assert.match((await body("?g=x&size=1000")).text, /width="256" height="256"/);
  assert.match((await body("?g=x&size=-40")).text, /width="8" height="8"/);
  assert.match((await body("?g=x&size=8")).text, /width="8" height="8"/);
  assert.match((await body("?g=x&size=256")).text, /width="256" height="256"/);
});

test("opacity clamps to 0..1 and is emitted without float noise", async () => {
  assert.match((await body("?g=x&opacity=5")).text, /opacity="1"/);
  assert.match((await body("?g=x&opacity=-3")).text, /opacity="0"/);
  assert.match((await body("?g=x&opacity=0.125")).text, /opacity="0.125"/);
  assert.match((await body("?g=x&opacity=0.0600000001")).text, /opacity="0.06"/);
});

// --- rejection -----------------------------------------------------------------

const REJECTED = [
  ["g is required", ""],
  ["g is empty", "?g="],
  ["g is nine code points", "?g=abcdefghi"],
  ["g holds a NUL", "?g=%00"],
  ["g holds a newline", "?g=%0A"],
  ["g holds an escape", "?g=%1B"],
  ["g holds DEL", "?g=%7F"],
  ["size is not a number", "?g=x&size=abc"],
  ["size has a unit", "?g=x&size=48px"],
  ["size is fractional", "?g=x&size=4.5"],
  ["size is exponential", "?g=x&size=1e3"],
  ["opacity is not a number", "?g=x&opacity=none"],
  ["color is a name", "?g=x&color=red"],
  ["color is five digits", "?g=x&color=%2312345"],
  ["color has no hash", "?g=x&color=ffffff"],
  ["color is a url()", `?g=x&color=${encodeURIComponent("url(javascript:1)")}`],
];

for (const [label, query] of REJECTED) {
  test(`400 when ${label}`, async () => {
    const { res, text } = await body(query);
    assert.equal(res.status, 400, `${query} should be rejected`);
    assert.equal(res.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.ok(!text.includes("<svg"), "a rejection is not a broken SVG");
  });
}

// --- accepted edges ------------------------------------------------------------

test("one astral emoji is one code point, not two", async () => {
  const { res, text } = await body("?g=%F0%9F%9A%80");
  assert.equal(res.status, 200);
  assert.match(text, />🚀<\/text>/);
});

test("eight code points pass, nine do not", async () => {
  assert.equal(get("?g=abcdefgh").status, 200);
  assert.equal(get("?g=abcdefghi").status, 400);
  assert.equal(get(`?g=${encodeURIComponent("🚀🚀🚀🚀🚀🚀🚀🚀")}`).status, 200);
  assert.equal(get(`?g=${encodeURIComponent("🚀🚀🚀🚀🚀🚀🚀🚀🚀")}`).status, 400);
});

test("both hex colour forms are accepted verbatim", async () => {
  assert.match((await body("?g=x&color=%23fff")).text, /fill="#fff"/);
  assert.match((await body("?g=x&color=%23AABBCC")).text, /fill="#AABBCC"/);
});

test("unknown parameters are ignored, not an error", () => {
  assert.equal(get("?g=x&rotate=45&cachebust=1").status, 200);
});

// --- headers -------------------------------------------------------------------

test("a tile is an immutable, non-sniffable SVG", () => {
  const res = get("?g=x");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/svg+xml; charset=utf-8");
  assert.equal(res.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("a rejection is never cached as if it were a tile", () => {
  const res = get("?g=");
  assert.equal(res.status, 400);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});
