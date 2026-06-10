// src/core/fetching.js
// Pure feed-shaping: normalise raw RSS items, merge feeds fairly, trim to the cap. No
// network — the fetcher agent owns the I/O and hands the parsed results to these functions.

/**
 * Normalise one rss-parser item into our Article shape (DESIGN §4).
 * Feeds use different field names, so we pick the best available and fall back.
 */
export function toArticle(item, source) {
  return {
    title:         (item.title ?? "").trim(),
    url:           item.link ?? "",
    summary:       (item.contentSnippet ?? item.summary ?? item.content ?? "").trim(), // prefer the HTML-stripped snippet
    source,
    publishedDate: item.isoDate ?? item.pubDate ?? "", // prefer ISO date, fall back to raw pubDate
  };
}

/**
 * Round-robin interleave so no high-volume feed (e.g. Hacker News) drains the cap and
 * starves the others. Walks the feeds like table columns: 1st of every feed, then 2nd, ...
 * (worked example in DECISIONS.md).
 */
export function interleave(perFeed) {
  const out = [];
  const max = Math.max(0, ...perFeed.map((a) => a.length)); // longest feed = columns to walk
  for (let i = 0; i < max; i++) {
    for (const feedItems of perFeed) {
      if (feedItems[i]) out.push(feedItems[i]); // skip feeds that already ran out
    }
  }
  return out;
}

/** Merge the per-feed lists fairly, then enforce the article cap. */
export function selectArticles(perFeed, max) {
  return interleave(perFeed).slice(0, max);
}
