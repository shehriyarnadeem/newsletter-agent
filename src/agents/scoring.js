// src/agents/scoring.js
// Relevance scoring agent (embeddings + math, NO LLM). DESIGN §6.3. Owns the embedding I/O
// and sequencing; the pure decisions live in core/scoring.js.
import { vector } from "../lib/embeddings.js";
import { config } from "../config.js";
import { filterExcluded, labelByTopic, filterByRelevance, dedupe } from "../core/scoring.js";

const { relevanceThreshold, dedupThreshold } = config.scoring;

export async function scoringNode(state) {
  const { articles, preferences } = state;
  const { topics, exclusions } = preferences;

  const kept = filterExcluded(articles, exclusions);          // step 1: before any embedding
  const topicVecs = await Promise.all(topics.map((t) => vector(t))); // step 2: embed each topic once

  // Step 3: embed + label each article. Sequential — one shared embedder, no concurrent tensors.
  const scored = [];
  for (const a of kept) {
    const vec = await vector(`${a.title}. ${a.summary}`);
    const { label, score } = labelByTopic(vec, topicVecs, topics);
    scored.push({ ...a, vec, label, score });
  }

  // Steps 4 & 5: relevance cut, then dedup.
  const relevant = filterByRelevance(scored, relevanceThreshold);
  const survivors = dedupe(relevant, dedupThreshold);

  console.warn(
    `[scoring] ${articles.length} in -> ${kept.length} after exclusions -> ` +
    `${relevant.length} relevant -> ${survivors.length} after dedup`
  );

  return { ...state, articles: survivors };
}
