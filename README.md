# Personalized Newsletter Agent

A single command turns a natural-language preference string into a personalized,
Markdown newsletter. It fetches live RSS, filters by relevance using local embeddings,
summarises the survivors with an LLM, and assembles them into topic sections.

```bash
node src/index.js "I want AI news and open-source tooling, nothing about crypto"
# -> writes ./output/newsletter-<timestamp>.md and prints it to the console
```

## How it works

Five single-responsibility agents run as a linear [LangGraph](https://langchain-ai.github.io/langgraphjs/)
pipeline; one `state` object flows through each:

| # | Agent | Does | AI? |
|---|-------|------|-----|
| 1 | **preference** | parse the preference string → `{topics, keywords, exclusions}` | LLM |
| 2 | **fetcher** | pull 5 RSS feeds in parallel, normalise, cap at 30 (interleaved) | no |
| 3 | **scoring** | drop exclusions, embed + cosine-rank vs topics, filter, dedup | embeddings |
| 4 | **summariser** | 2–3 sentence grounded summary per survivor | LLM |
| 5 | **editor** | group by topic, write an intro, emit Markdown | LLM (intro only) |

See `DESIGN.md` for the full spec and `DECISIONS.md` for the design rationale.

Each agent is a thin orchestrator: it owns its I/O (LLM, RSS, embedder) and delegates the
pure logic to `src/core/` (`fetching`, `scoring`, `newsletter`) and `src/lib/`
(`embeddings`, `llm`, `json`). All tunable knobs — model ids, token caps, the article cap,
parser options, and the relevance/dedup thresholds — live in one place: `src/config.js`.

## Setup

Requires **Node.js 20+**.

```bash
npm install
```

Create a `.env` file in the project root with your OpenAI key:

```
OPENAI_API_KEY=sk-...
```

> **First run downloads ~90 MB** — the `all-MiniLM-L6-v2` embedding model is fetched once
> and cached under `node_modules` (so a reinstall re-downloads it). It runs locally on CPU;
> no embedding API calls or costs.

## Usage

```bash
node src/index.js "<your preferences in plain English>"
```

Examples:

```bash
node src/index.js "AI news and open-source tooling, nothing about crypto"
node src/index.js "startup funding and venture capital, no big-tech product launches"
```

The newsletter is printed to stdout and saved to `./output/newsletter-<timestamp>.md`.
Two example outputs are committed in `output/` (`sample-1-*.md`, `sample-2-*.md`).

## Testing

The pure logic (vector math, feed shaping, relevance/dedup, Markdown rendering, JSON
extraction) has unit tests that need no network or API key:

```bash
npm test    # node --test test/
```

## Feeds

Fixed list of 5 (no dynamic discovery): Hacker News, Guardian Tech, ArXiv CS.AI,
TechCrunch, Google News (AI search). A dead/slow feed is skipped, not fatal.

## Notes / gotchas

- **IPv4 is forced** in the fetcher — some feeds (HN, Google News) hang on broken IPv6
  dual-stack (`AggregateError ETIMEDOUT`). See `fetch.parser` in `src/config.js`.
- **Relevance thresholds** — `relevanceThreshold = 0.30`, `dedupThreshold = 0.85`
  (`scoring` in `src/config.js`). MiniLM cosines run low, so the cut sits near 0.3, not 0.7.
  See `DECISIONS.md` for why 0.30 (not 0.35) — it's topic-robust. Tune for your feeds/topics.
- All LLM calls use `gpt-5.4-mini` (`models` in `src/config.js`).
