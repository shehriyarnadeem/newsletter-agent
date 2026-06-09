// src/agents/editor.js
// Editor agent (light LLM). DESIGN §6.5.
// Reads:  summarised state.articles (each has label + aiSummary)
// Writes: state.newsletter (final Markdown string)
import { ask } from "../lib/llm.js";

const MODEL = "gpt-5.4-mini"; // one short call for the intro blurb only

const SYSTEM = `You write a short, friendly intro for a personalized tech newsletter.
Write 1-2 sentences that set up the themes below. Plain prose only — no markdown,
no greeting like "Dear reader", no lists. Do not invent specific facts or headlines.`;

/** Group articles into a Map keyed by their winning topic label, preserving order. */
function groupByLabel(articles) {
  const groups = new Map();
  for (const a of articles) {
    if (!groups.has(a.label)) groups.set(a.label, []);
    groups.get(a.label).push(a);
  }
  return groups;
}

/** One LLM call: a 1-2 sentence intro grounded in the section topics + headlines. */
async function writeIntro(groups) {
  const outline = [...groups.entries()]
    .map(([label, arts]) => `${label}: ${arts.map((a) => a.title).join("; ")}`)
    .join("\n");
  return (await ask({
    model: MODEL,
    system: SYSTEM,
    user: `Topics and headlines in this issue:\n${outline}`,
    maxTokens: 120,
  })).trim();
}

export async function editorNode(state) {
  const groups = groupByLabel(state.articles);
  const intro = await writeIntro(groups);

  // --- assemble Markdown deterministically (no LLM here) ---
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`# Your Personalized Newsletter`, `_${today}_`, ``, intro, ``];

  for (const [label, arts] of groups) {
    lines.push(`## ${label}`, ``);          // one section per topic
    for (const a of arts) {
      lines.push(`### [${a.title}](${a.url})`);          // linked headline
      lines.push(`*${a.source}*`, ``);                    // light source attribution
      lines.push(a.aiSummary, ``);                        // the grounded summary
    }
  }

  const newsletter = lines.join("\n").trim() + "\n";
  console.warn(`[editor] ${groups.size} sections, ${state.articles.length} articles`);
  return { ...state, newsletter };
}
