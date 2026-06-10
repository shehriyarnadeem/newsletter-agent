// test/core/scoring.test.js — pure relevance logic with hand-built vectors (no model).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterExcluded,
  labelByTopic,
  filterByRelevance,
  dedupe,
} from "../../src/core/scoring.js";

// --- filterExcluded -------------------------------------------------------

test("filterExcluded drops articles whose title or summary mentions a ban term", () => {
  const articles = [
    { title: "Bitcoin soars", summary: "crypto rally" },
    { title: "New LLM released", summary: "open source" },
    { title: "Markets update", summary: "Crypto winter continues" }, // case-insensitive
  ];
  const kept = filterExcluded(articles, ["crypto"]);
  assert.deepEqual(kept.map((a) => a.title), ["New LLM released"]);
});

test("filterExcluded matches across the title+summary boundary, case-insensitively", () => {
  const articles = [{ title: "CRYPTO", summary: "" }, { title: "", summary: "ok" }];
  assert.deepEqual(filterExcluded(articles, ["crypto"]).map((a) => a.title), [""]);
});

test("filterExcluded with no exclusions keeps everything", () => {
  const articles = [{ title: "a", summary: "" }, { title: "b", summary: "" }];
  assert.equal(filterExcluded(articles, []).length, 2);
});

// --- labelByTopic ---------------------------------------------------------

test("labelByTopic picks the highest-cosine topic as the label", () => {
  const articleVec = [1, 0];                 // points along topic A
  const topicVecs = [[1, 0], [0, 1]];        // A, B
  const { label, score } = labelByTopic(articleVec, topicVecs, ["A", "B"]);
  assert.equal(label, "A");
  assert.equal(score, 1);
});

test("labelByTopic returns the max score across topics", () => {
  const articleVec = [0.6, 0.8];
  const topicVecs = [[1, 0], [0, 1]];        // cosines 0.6 and 0.8
  const { label, score } = labelByTopic(articleVec, topicVecs, ["A", "B"]);
  assert.equal(label, "B");
  assert.ok(Math.abs(score - 0.8) < 1e-9);
});

// --- filterByRelevance ----------------------------------------------------

test("filterByRelevance keeps scores >= threshold (boundary inclusive)", () => {
  const scored = [{ score: 0.5 }, { score: 0.3 }, { score: 0.29 }];
  assert.deepEqual(filterByRelevance(scored, 0.3).map((a) => a.score), [0.5, 0.3]);
});

// --- dedupe ---------------------------------------------------------------

test("dedupe drops a near-identical later article, keeps the first", () => {
  const articles = [
    { id: 1, vec: [1, 0] },
    { id: 2, vec: [0.999, 0.0447] }, // ~0.999 cosine to #1 -> duplicate
    { id: 3, vec: [0, 1] },          // orthogonal -> kept
  ];
  assert.deepEqual(dedupe(articles, 0.85).map((a) => a.id), [1, 3]);
});

test("dedupe at the boundary drops on >= threshold", () => {
  const articles = [{ id: 1, vec: [1, 0] }, { id: 2, vec: [1, 0] }]; // cosine exactly 1
  assert.deepEqual(dedupe(articles, 1).map((a) => a.id), [1]);
});

test("dedupe keeps everything when nothing is similar enough", () => {
  const articles = [{ id: 1, vec: [1, 0] }, { id: 2, vec: [0, 1] }];
  assert.equal(dedupe(articles, 0.85).length, 2);
});
