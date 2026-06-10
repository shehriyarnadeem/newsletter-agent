// test/lib/json.test.js — extractJson() tolerance for the shapes LLMs return.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJson } from "../../src/lib/json.js";

test("parses a bare JSON object", () => {
  assert.deepEqual(extractJson('{"topics":["AI"],"keywords":[],"exclusions":[]}'), {
    topics: ["AI"],
    keywords: [],
    exclusions: [],
  });
});

test("strips a ```json code fence", () => {
  const reply = '```json\n{"topics":["AI"]}\n```';
  assert.deepEqual(extractJson(reply), { topics: ["AI"] });
});

test("strips a plain ``` fence", () => {
  assert.deepEqual(extractJson('```\n{"a":1}\n```'), { a: 1 });
});

test("ignores stray prose around the object", () => {
  const reply = 'Sure! Here is the JSON:\n{"a":1,"b":2}\nHope that helps.';
  assert.deepEqual(extractJson(reply), { a: 1, b: 2 });
});

test("grabs the full span across nested braces", () => {
  const reply = '{"a":{"b":1},"c":2}';
  assert.deepEqual(extractJson(reply), { a: { b: 1 }, c: 2 });
});

test("throws when no JSON object is present", () => {
  assert.throws(() => extractJson("no object here"), /no JSON object found/);
});

test("throws on malformed JSON inside the braces", () => {
  assert.throws(() => extractJson('{"a": }'));
});
