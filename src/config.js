// src/config.js
// Every tunable knob in one place. Prompts stay in their agents (part of each agent's
// responsibility); only the numeric/model knobs live here. Frozen against stray writes.

export const config = Object.freeze({
  // DESIGN §3: gpt-5.4-mini for all calls; bump preference to gpt-5.4 only if exclusions slip.
  models: Object.freeze({
    preference: "gpt-5.4-mini",
    summariser: "gpt-5.4-mini",
    editor:     "gpt-5.4-mini",
  }),

  // Per-call reply caps (max_completion_tokens), sized to each agent's output.
  maxTokens: Object.freeze({
    preference: 300,
    summariser: 160,
    editor:     120,
  }),

  // Article cap (DESIGN §2) + the rss-parser options that make the real feeds work on this
  // machine (IPv4 forcing, redirects, UA — see PROGRESS.md "Environment fixes").
  fetch: Object.freeze({
    maxArticles: 30,
    parser: Object.freeze({
      timeout: 15000,
      maxRedirects: 5,                // Google News RSS 302-redirects to the real feed URL
      requestOptions: { family: 4 },  // force IPv4 — HN/Google News hang on broken IPv6
      headers: { "User-Agent": "Mozilla/5.0 (compatible; newsletter-agent/1.0)" }, // HN blocks the default UA
    }),
  }),

  // Tuned against live score distributions across two topic sets (DESIGN §6.3, DECISIONS.md).
  scoring: Object.freeze({
    relevanceThreshold: 0.30, // keep an article only if its best topic-match cosine >= this
    dedupThreshold:     0.85, // drop an article this similar to one already kept
  }),
});
