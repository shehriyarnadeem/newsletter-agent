// src/agents/scoring.js
// Relevance scoring agent (embeddings + math, NO LLM). DESIGN §6.3.
// Reads:  state.articles, state.preferences
// Writes: state.articles (filtered; each survivor gains vec, label, score)
import { vector, cosine } from "../lib/embeddings.js";

// Two tunable knobs (DESIGN §6.3). Tune against real output.
// Kept at 0.30 (not 0.35): tuned across TWO different topic sets. Abstract topics like
// "venture capital" score concrete headlines ("X raises $30M") lower than AI topics do, so
// 0.35 emptied a reasonable query to zero. 0.30 stays mostly precise yet robust across topics.
const RELEVANCE_THRESHOLD = 0.30; // keep an article only if its best topic-match cosine >= this
const DEDUP_THRESHOLD     = 0.85; // drop an article if it's this similar to one already kept

/** Cheap exact pre-filter: does "title + summary" mention any exclusion term? (case-insensitive) */
function isExcluded(article, exclusions) {
  const haystack = `${article.title} ${article.summary}`.toLowerCase();
  return exclusions.some((term) => haystack.includes(term.toLowerCase()));
}

export async function scoringNode(state) {
  const { articles, preferences } = state;
  const { topics, exclusions } = preferences;

  // --- Step 1: drop excluded articles (cheap keyword pass, before any embedding) ---
  // Embeddings are too blunt for hard "never include" rules, so we do this exactly first.
  const kept = articles.filter((a) => !isExcluded(a, exclusions));

  // --- Step 2: embed each interest ONCE (reused across every article) ---
  const topicVecs = await Promise.all(topics.map((t) => vector(t)));

  // --- Step 3: embed each article and score it against every topic; keep the best match ---
  // Done sequentially (one shared embedder instance — avoid concurrent tensor calls).
  const scored = [];
  for (const a of kept) {
    const vec = await vector(`${a.title}. ${a.summary}`); // embed headline + body together
    let best = -1;
    let label = topics[0];
    for (let i = 0; i < topicVecs.length; i++) {
      const sim = cosine(vec, topicVecs[i]);   // both vectors are normalised -> dot product
      if (sim > best) { best = sim; label = topics[i]; } // remember the winning topic
    }
    scored.push({ ...a, vec, label, score: best }); // attach embedding, winning topic, its score
  }

  // --- Step 4: drop anything that isn't relevant enough to any topic ---
  const relevant = scored.filter((a) => a.score >= RELEVANCE_THRESHOLD);

  // --- Step 5: dedup near-identical stories (same news from two feeds) ---
  // Keep an article only if it's NOT too similar to any already-kept article.
  const survivors = [];
  for (const a of relevant) {
    const dupe = survivors.some((k) => cosine(a.vec, k.vec) >= DEDUP_THRESHOLD);
    if (!dupe) survivors.push(a);
  }

  console.warn(
    `[scoring] ${articles.length} in -> ${kept.length} after exclusions -> ` +
    `${relevant.length} relevant -> ${survivors.length} after dedup`
  );

  return { ...state, articles: survivors };
}
