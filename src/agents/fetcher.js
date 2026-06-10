// src/agents/fetcher.js
// Fetcher agent (no AI). Owns only the I/O — fetch the feeds in parallel, tolerate
// failures, log. The pure shaping (normalise / interleave / cap) lives in core/fetching.js.
import Parser from "rss-parser";
import { FEEDS } from "../feeds.js";
import { config } from "../config.js";
import { toArticle, selectArticles } from "../core/fetching.js";

// rss-parser mutates the options object it's given, so hand it a deep copy of the frozen config.
const parser = new Parser(structuredClone(config.fetch.parser));

export async function fetcherNode(state) {
  // allSettled (not all) so one dead feed can't crash the run.
  const results = await Promise.allSettled(FEEDS.map((feed) => parser.parseURL(feed.url)));

  const perFeed = results.map((res, i) => {
    const feed = FEEDS[i];
    if (res.status !== "fulfilled") {
      console.warn(`[fetcher] skipped "${feed.name}": ${res.reason?.message ?? res.reason}`);
      return [];
    }
    return (res.value.items ?? []).map((item) => toArticle(item, feed.name));
  });

  const articles = selectArticles(perFeed, config.fetch.maxArticles);
  console.warn(`[fetcher] ${articles.length} articles from ${perFeed.filter((f) => f.length).length}/${FEEDS.length} feeds`);

  return { ...state, articles };
}
