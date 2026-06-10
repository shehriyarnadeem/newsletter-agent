// test/core/newsletter.test.js — pure grouping + Markdown rendering.
import { test } from "node:test";
import assert from "node:assert/strict";
import { groupByLabel, renderMarkdown } from "../../src/core/newsletter.js";

const articles = [
  { label: "AI", title: "Model X ships", url: "http://a", source: "HN", aiSummary: "It ships." },
  { label: "Open Source", title: "Tool Y v2", url: "http://b", source: "TC", aiSummary: "New version." },
  { label: "AI", title: "Chip Z benchmark", url: "http://c", source: "Guardian", aiSummary: "Fast chip." },
];

test("groupByLabel buckets by label, preserving first-seen order", () => {
  const groups = groupByLabel(articles);
  assert.deepEqual([...groups.keys()], ["AI", "Open Source"]);
  assert.deepEqual(groups.get("AI").map((a) => a.title), ["Model X ships", "Chip Z benchmark"]);
  assert.deepEqual(groups.get("Open Source").map((a) => a.title), ["Tool Y v2"]);
});

test("groupByLabel of an empty list is an empty map", () => {
  assert.equal(groupByLabel([]).size, 0);
});

test("renderMarkdown emits title, date, intro, and one section per label", () => {
  const md = renderMarkdown({ groups: groupByLabel(articles), intro: "Hello there.", date: "2026-06-10" });
  assert.ok(md.startsWith("# Your Personalized Newsletter\n"));
  assert.match(md, /_2026-06-10_/);
  assert.match(md, /Hello there\./);
  assert.match(md, /^## AI$/m);
  assert.match(md, /^## Open Source$/m);
  assert.equal((md.match(/^## /gm) || []).length, 2); // exactly two sections
});

test("renderMarkdown links every article headline and attributes its source", () => {
  const md = renderMarkdown({ groups: groupByLabel(articles), intro: "x", date: "2026-06-10" });
  assert.match(md, /### \[Model X ships\]\(http:\/\/a\)/);
  assert.match(md, /### \[Tool Y v2\]\(http:\/\/b\)/);
  assert.match(md, /### \[Chip Z benchmark\]\(http:\/\/c\)/);
  assert.equal((md.match(/^### \[/gm) || []).length, articles.length); // one link per article
  assert.match(md, /\*HN\*/);
});

test("renderMarkdown includes each article's grounded summary and ends with a newline", () => {
  const md = renderMarkdown({ groups: groupByLabel(articles), intro: "x", date: "2026-06-10" });
  assert.match(md, /It ships\./);
  assert.match(md, /New version\./);
  assert.ok(md.endsWith("\n"));
});
