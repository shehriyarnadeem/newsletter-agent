// src/agents/editor.js
// Editor agent (light LLM, DESIGN §6.5). Owns the one LLM call (the intro blurb); grouping
// and Markdown rendering live in core/newsletter.js. Writes state.newsletter.
import { ask } from "../lib/llm.js";
import { config } from "../config.js";
import { groupByLabel, renderMarkdown } from "../core/newsletter.js";

const SYSTEM = `You write a short, friendly intro for a personalized tech newsletter.
Write 1-2 sentences that set up the themes below. Plain prose only — no markdown,
no greeting like "Dear reader", no lists. Do not invent specific facts or headlines.`;

/** One LLM call: a 1-2 sentence intro grounded in the section topics + headlines. */
async function writeIntro(groups) {
  const outline = [...groups.entries()]
    .map(([label, arts]) => `${label}: ${arts.map((a) => a.title).join("; ")}`)
    .join("\n");
  return (await ask({
    model: config.models.editor,
    system: SYSTEM,
    user: `Topics and headlines in this issue:\n${outline}`,
    maxTokens: config.maxTokens.editor,
  })).trim();
}

export async function editorNode(state) {
  const groups = groupByLabel(state.articles);
  const intro = await writeIntro(groups);

  const date = new Date().toISOString().slice(0, 10);
  const newsletter = renderMarkdown({ groups, intro, date });

  console.warn(`[editor] ${groups.size} sections, ${state.articles.length} articles`);
  return { ...state, newsletter };
}
