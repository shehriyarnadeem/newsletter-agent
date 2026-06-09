// src/agents/fetcher.js
// Fetcher agent (no AI). Reads nothing from state; uses the fixed FEEDS list.
// Writes state.articles: up to 30 normalised Article objects.
import Parser from "rss-parser";          // turns an RSS/Atom feed URL into a JS object
import { FEEDS } from "../feeds.js";      // the fixed 5-feed list (DESIGN §5)

const MAX_ARTICLES = 30;                  // hard cap per run (DESIGN §2) — trim the pile to this

// One reusable parser, configured once. These options were all needed to make the
// real feeds work on this machine (see PROGRESS.md "Environment fixes"):
const parser = new Parser({
  timeout: 15000,                   // give up on a feed after 15s instead of hanging forever
  maxRedirects: 5,                  // Google News RSS 302-redirects to the real feed URL
  requestOptions: { family: 4 },    // force IPv4 — HN/Google News hang on broken IPv6 (AggregateError ETIMEDOUT)
  headers: { "User-Agent": "Mozilla/5.0 (compatible; newsletter-agent/1.0)" }, // HN blocks the default UA
});

/**
 * Normalise one rss-parser item into our Article shape (DESIGN §4).
 * Feeds use different field names, so we pick the best available and fall back.
 */
function toArticle(item, source) {
  return {
    // ?? = "use the left value unless it's null/undefined, then use the right"
    title:         (item.title ?? "").trim(),                                   // headline
    url:           item.link ?? "",                                             // link to the article
    summary:       (item.contentSnippet ?? item.summary ?? item.content ?? "").trim(), // body text: prefer the HTML-stripped snippet
    source,                                                                     // feed name, e.g. "Hacker News" (shorthand for source: source)
    publishedDate: item.isoDate ?? item.pubDate ?? "",                          // prefer the ISO date; fall back to raw pubDate
  };
}

/**
 * Round-robin interleave so no single high-volume feed (e.g. Hacker News)
 * dominates the 30-article cap and starves the others.
 * Reads the feeds like COLUMNS of a table: 1st of every feed, then 2nd of every feed, ...
 * See the worked example in the chat / DECISIONS.md.
 */
function interleave(perFeed) {
  const out = [];                                          // the merged, fairly-ordered list we build up
  const max = Math.max(0, ...perFeed.map((a) => a.length)); // length of the LONGEST feed = how many columns to walk
  for (let i = 0; i < max; i++) {                          // i = column index (0 = each feed's newest item, 1 = next, ...)
    for (const feedItems of perFeed) {                     // walk every feed at this same column
      if (feedItems[i]) out.push(feedItems[i]);            // add its i-th item; skip feeds that already ran out (undefined)
    }
  }
  return out;
}

// The agent itself. Shape is async (state) => state, matching the graph node contract (DESIGN §8).
export async function fetcherNode(state) {
  // Fetch all 5 feeds AT THE SAME TIME. allSettled (not all) waits for every promise and
  // never rejects — so one dead feed can't crash the whole run.
  const results = await Promise.allSettled(
    FEEDS.map((feed) => parser.parseURL(feed.url))         // kick off one parseURL per feed
  );

  // Turn the raw settle-results into a per-feed array of normalised Articles.
  const perFeed = results.map((res, i) => {
    const feed = FEEDS[i];                                 // results line up with FEEDS by index
    if (res.status !== "fulfilled") {                      // this feed failed (timeout, 404, bad DNS, ...)
      console.warn(`[fetcher] skipped "${feed.name}": ${res.reason?.message ?? res.reason}`); // log & move on
      return [];                                           // contribute nothing, don't throw
    }
    // res.value is the parsed feed; .items is its article list. Normalise each one.
    return (res.value.items ?? []).map((item) => toArticle(item, feed.name));
  });

  // Merge fairly across feeds, then enforce the 30 cap by slicing.
  const articles = interleave(perFeed).slice(0, MAX_ARTICLES);
  console.warn(`[fetcher] ${articles.length} articles from ${perFeed.filter((f) => f.length).length}/${FEEDS.length} feeds`); // e.g. "30 articles from 5/5 feeds"

  // Return a NEW state object with articles added; spread keeps every other field intact.
  return { ...state, articles };
}
