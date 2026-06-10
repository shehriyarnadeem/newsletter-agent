// test/core/math.test.js — cosine() pure math (no model load).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cosine } from "../../src/core/math.js";

test("identical normalised vectors score 1", () => {
  const v = [0.6, 0.8]; // already unit length
  assert.equal(cosine(v, v), 1);
});

test("orthogonal vectors score 0", () => {
  assert.equal(cosine([1, 0], [0, 1]), 0);
});

test("opposite vectors score -1", () => {
  assert.equal(cosine([1, 0], [-1, 0]), -1);
});

test("is the dot product for normalised inputs", () => {
  assert.ok(Math.abs(cosine([0.6, 0.8], [0.8, 0.6]) - 0.96) < 1e-9);
});

test("partial overlap sits between 0 and 1", () => {
  const s = cosine([0.6, 0.8], [0.96, 0.28]); // 0.576 + 0.224 = 0.8
  assert.ok(s > 0 && s < 1);
  assert.ok(Math.abs(s - 0.8) < 1e-9);
});
