// test/core/fetching.test.js — pure feed-shaping logic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toArticle, interleave, selectArticles } from "../../src/core/fetching.js";

test("toArticle maps standard fields and trims whitespace", () => {
  const a = toArticle(
    { title: "  Hello  ", link: "http://x", contentSnippet: "  body  ", isoDate: "2026-01-01" },
    "Hacker News"
  );
  assert.deepEqual(a, {
    title: "Hello",
    url: "http://x",
    summary: "body",
    source: "Hacker News",
    publishedDate: "2026-01-01",
  });
});

test("toArticle falls back through summary/content for the body", () => {
  assert.equal(toArticle({ summary: "from summary" }, "S").summary, "from summary");
  assert.equal(toArticle({ content: "from content" }, "S").summary, "from content");
});

test("toArticle prefers contentSnippet over summary/content", () => {
  const a = toArticle({ contentSnippet: "snip", summary: "sum", content: "cont" }, "S");
  assert.equal(a.summary, "snip");
});

test("toArticle falls back to pubDate when isoDate is absent", () => {
  assert.equal(toArticle({ pubDate: "Mon, 01 Jan 2026" }, "S").publishedDate, "Mon, 01 Jan 2026");
});

test("toArticle yields empty strings for a totally empty item", () => {
  assert.deepEqual(toArticle({}, "S"), {
    title: "",
    url: "",
    summary: "",
    source: "S",
    publishedDate: "",
  });
});

test("interleave reads feeds column-by-column (round-robin)", () => {
  const perFeed = [
    ["a1", "a2", "a3"],
    ["b1", "b2"],
    ["c1"],
  ];
  assert.deepEqual(interleave(perFeed), ["a1", "b1", "c1", "a2", "b2", "a3"]);
});

test("interleave handles empty feeds and an all-empty input", () => {
  assert.deepEqual(interleave([[], ["b1"], []]), ["b1"]);
  assert.deepEqual(interleave([[], [], []]), []);
  assert.deepEqual(interleave([]), []);
});

test("selectArticles interleaves then caps to max", () => {
  const perFeed = [
    ["a1", "a2", "a3"],
    ["b1", "b2", "b3"],
  ];
  // interleaved: a1 b1 a2 b2 a3 b3 -> cap 4
  assert.deepEqual(selectArticles(perFeed, 4), ["a1", "b1", "a2", "b2"]);
});

test("selectArticles fairly distributes the cap so no feed starves", () => {
  const hn = Array.from({ length: 50 }, (_, i) => `hn${i}`);
  const tc = Array.from({ length: 50 }, (_, i) => `tc${i}`);
  const out = selectArticles([hn, tc], 30);
  assert.equal(out.length, 30);
  assert.equal(out.filter((x) => x.startsWith("hn")).length, 15);
  assert.equal(out.filter((x) => x.startsWith("tc")).length, 15);
});
