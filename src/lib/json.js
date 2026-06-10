// src/lib/json.js
// Pull a JSON object out of an LLM reply — a reusable parsing concern, independent of any
// one agent.

/**
 * Extract and parse the first JSON object in a block of text, tolerating ```json fences or
 * stray prose. Throws if no `{...}` span is present (or it isn't valid JSON).
 */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i); // strip a code fence if present
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found in reply");
  return JSON.parse(candidate.slice(start, end + 1));
}
