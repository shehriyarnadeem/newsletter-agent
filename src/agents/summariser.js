// src/agents/summariser.js
// Summariser agent (LLM, high-volume, DESIGN §6.4). Writes article.aiSummary on each survivor.
import { ask } from "../lib/llm.js";
import { config } from "../config.js";

// Grounding is the whole point: the model must NOT add facts beyond the source text —
// critical for HN items whose summary is just "Comments" (only the title is real).
const SYSTEM = `You write a 2-3 sentence summary of one news article for a newsletter.
Rules:
- Use ONLY the information in the provided Title and Summary. Do not add facts, names,
  numbers, dates, or context that are not present in that text.
- If the text is too thin (e.g. only a title, or a placeholder like "Comments"), write a
  single natural sentence based on the title alone.
- NEVER mention the summary, the source feed, the word "Comments", or that information is
  missing/limited. Just describe what the title says, naturally.
- Output plain prose only: no preamble, no markdown, no bullet points, no quotes.`;

/** Summarise one article from its title + raw feed summary. */
async function summariseOne(article) {
  const user = `Title: ${article.title}\nSummary: ${article.summary || "(none provided)"}`;
  const aiSummary = (await ask({
    model: config.models.summariser,
    system: SYSTEM,
    user,
    maxTokens: config.maxTokens.summariser,
  })).trim();
  return { ...article, aiSummary };
}

export async function summariserNode(state) {
  // Concurrent — the OpenAI client handles parallel HTTP fine (unlike the shared embedder).
  const articles = await Promise.all(state.articles.map(summariseOne));
  console.warn(`[summariser] wrote aiSummary for ${articles.length} articles`);
  return { ...state, articles };
}
