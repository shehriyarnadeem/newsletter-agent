// src/agents/preference.js
// Preference agent (LLM). Reads state.rawInput; writes state.preferences (DESIGN §6.1).
// Turns a free-text preference string into structured {topics, keywords, exclusions}.
import { ask } from "../lib/llm.js";
import { PreferencesSchema } from "../state.js";

const MODEL = "gpt-5.4-mini"; // DESIGN §3: bump to "gpt-5.4" only if exclusions slip

// JSON-only instructions. We forbid prose/markdown so the reply is straight to parse.
const SYSTEM = `You convert a user's newsletter preferences into structured JSON.
Return ONLY a JSON object — no prose, no markdown fences — with exactly these keys:
- "topics": string[]  — the subjects the user wants to read about (at least one).
- "keywords": string[] — extra specific terms worth matching; use [] if none.
- "exclusions": string[] — subjects the user explicitly does NOT want; use [] if none.
Infer sensible topics from natural language. Keep each term short (1-4 words).`;

/** Pull a JSON object out of the reply, tolerating ```json fences or stray text. */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i); // strip a code fence if present
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found in reply");
  return JSON.parse(candidate.slice(start, end + 1)); // the {...} span only
}

/** Ask once, parse, and validate against the Zod schema. Throws on any failure. */
async function parseOnce(rawInput) {
  const reply = await ask({ model: MODEL, system: SYSTEM, user: rawInput, maxTokens: 300 });
  const obj = extractJson(reply);            // text -> JS object
  return PreferencesSchema.parse(obj);       // throws if shape/types are wrong
}

export async function preferenceNode(state) {
  let preferences;
  try {
    preferences = await parseOnce(state.rawInput);          // first attempt
  } catch (err) {
    console.warn(`[preference] first parse failed (${err.message}); retrying once`);
    preferences = await parseOnce(state.rawInput);          // retry once (DESIGN §6.1)
  }
  return { ...state, preferences };
}
