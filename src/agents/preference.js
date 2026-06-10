// src/agents/preference.js
// Preference agent (LLM, DESIGN §6.1). Turns the free-text preference string into structured
// {topics, keywords, exclusions}.
import { ask } from "../lib/llm.js";
import { PreferencesSchema } from "../state.js";
import { extractJson } from "../lib/json.js";
import { config } from "../config.js";

// JSON-only: forbid prose/markdown so the reply is straight to parse.
const SYSTEM = `You convert a user's newsletter preferences into structured JSON.
Return ONLY a JSON object — no prose, no markdown fences — with exactly these keys:
- "topics": string[]  — the subjects the user wants to read about (at least one).
- "keywords": string[] — extra specific terms worth matching; use [] if none.
- "exclusions": string[] — subjects the user explicitly does NOT want; use [] if none.
Infer sensible topics from natural language. Keep each term short (1-4 words).`;

/** Ask once, parse, and validate against the Zod schema. Throws on any failure. */
async function parseOnce(rawInput) {
  const reply = await ask({
    model: config.models.preference,
    system: SYSTEM,
    user: rawInput,
    maxTokens: config.maxTokens.preference,
  });
  return PreferencesSchema.parse(extractJson(reply)); // throws if shape/types are wrong
}

export async function preferenceNode(state) {
  let preferences;
  try {
    preferences = await parseOnce(state.rawInput);
  } catch (err) {
    console.warn(`[preference] first parse failed (${err.message}); retrying once`);
    preferences = await parseOnce(state.rawInput); // retry once (DESIGN §6.1)
  }
  return { ...state, preferences };
}
