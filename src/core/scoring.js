// src/core/scoring.js
// Pure relevance logic (DESIGN §6.3): exclude / label / relevance-cut / dedup. Vectors are
// passed in as plain arrays, so every function is deterministic and unit-testable without a
// model. The scoring agent owns the async embedding and just sequences these steps.
import { cosine } from "./math.js";

/** Does "title + summary" mention any exclusion term? (case-insensitive) */
function isExcluded(article, exclusions) {
  const haystack = `${article.title} ${article.summary}`.toLowerCase();
  return exclusions.some((term) => haystack.includes(term.toLowerCase()));
}

/** Step 1: drop hard exclusions first — embeddings are too blunt for "never include X". */
export function filterExcluded(articles, exclusions) {
  return articles.filter((a) => !isExcluded(a, exclusions));
}

/** Score one article's vector against every topic and return the best-matching topic + cosine. */
export function labelByTopic(articleVec, topicVecs, topics) {
  let score = -1;
  let label = topics[0];
  for (let i = 0; i < topicVecs.length; i++) {
    const sim = cosine(articleVec, topicVecs[i]);
    if (sim > score) { score = sim; label = topics[i]; }
  }
  return { label, score };
}

/** Step 4: keep only articles whose best topic-match cosine clears the threshold. */
export function filterByRelevance(scored, threshold) {
  return scored.filter((a) => a.score >= threshold);
}

/** Step 5: drop near-duplicate stories (same news across two feeds). Order-preserving. */
export function dedupe(articles, threshold) {
  const survivors = [];
  for (const a of articles) {
    const dupe = survivors.some((k) => cosine(a.vec, k.vec) >= threshold);
    if (!dupe) survivors.push(a);
  }
  return survivors;
}
