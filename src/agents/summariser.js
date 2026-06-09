// src/agents/summariser.js
// Summariser agent (LLM, high-volume). DESIGN §6.4.
// Reads:  surviving state.articles
// Writes: article.aiSummary on each
import { ask } from "../lib/llm.js";

const MODEL = "gpt-5.4-mini"; // cheap; this is the highest-volume call (~1 per survivor)

// Grounding is the whole point: the model must NOT add facts beyond the source text.
// Critical for HN items whose summary is just "Comments" — only the title is real.
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
  const aiSummary = (await ask({ model: MODEL, system: SYSTEM, user, maxTokens: 160 })).trim();
  return { ...article, aiSummary };
}

export async function summariserNode(state) {
  // Independent calls -> run them concurrently. The OpenAI client handles parallel HTTP fine
  // (unlike the single shared embedder in scoring, which we kept sequential).
  const articles = await Promise.all(state.articles.map(summariseOne));
  console.warn(`[summariser] wrote aiSummary for ${articles.length} articles`);
  return { ...state, articles };
}
