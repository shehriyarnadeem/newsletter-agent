# Personalized Newsletter Agent — DESIGN.md

Single source of truth for this build. Contracts first, logic second. Anything marked
**done-when** is the acceptance test for that piece — if it passes, the piece is finished.

---

## 0. Ground rules for the build agent (read first, every time)

These are hard constraints. Follow them over any default instinct.

1. **This file is the only source of truth.** If something isn't specified here, ask
   before inventing it. Do not add features, files, packages, or fields not listed.
2. **Use only the exact package names and model strings in section 3.** Do not substitute
   similar-sounding packages. The embeddings package is `@huggingface/transformers` — the
   old `@xenova/transformers` is wrong and must never be used.
3. **Do not guess library APIs.** Before using a method from any dependency, confirm its
   real signature against the installed package's types or its official docs. If you can't
   confirm it, stop and say so rather than inventing a plausible-looking call.
4. **Build one file at a time, in the section 9 order.** After each file, run its
   **done-when** check and show the result before moving to the next. Do not generate all
   five agents at once.
5. **Each agent is `(state) => state`.** It reads only the fields its contract names and
   writes only the fields its contract names. No agent reaches outside its contract.
6. **No hidden state.** Everything an agent needs comes from the state object. No globals
   except the cached embedder/LLM client in the `lib/` helpers.
7. **When unsure, stop and ask.** A clarifying question is always preferred over a guess.

---

## 1. Goal

A single command takes a natural-language preference string and writes a personalized
newsletter (Markdown) to disk. It does this by fetching live RSS, filtering by relevance,
summarising the survivors, and assembling them into sections. Stateless — every run is
independent.

```bash
node src/index.js "I want AI news and open-source tooling, nothing about crypto"
# -> writes ./output/newsletter-<timestamp>.md and prints it to the console
```

---

## 2. Scope (locked — do not expand)

- Exactly 5 fixed RSS feeds. No dynamic feed discovery.
- Hard cap of 30 articles per run (trim the pile before scoring).
- No email delivery, no database, no persistence between runs.
- Output is a Markdown file + console print.
- Runtime: Node.js 20+, ESM (`"type": "module"`).
- Stretch goals are out of scope for v1.

---

## 3. Stack (package names verified current)

| Role | Package | Notes |
| --- | --- | --- |
| Orchestration | `@langchain/langgraph` | `StateGraph` + `Annotation.Root` |
| LLM | `openai` | `gpt-5.4-mini` for all calls; bump preference parse to `gpt-5.4` only if mini slips on exclusions |
| Embeddings (local, free) | `@huggingface/transformers` | model `Xenova/all-MiniLM-L6-v2`, 384-dim. NOT the old `@xenova/transformers` |
| RSS parsing | `rss-parser` | |
| Schema / validation | `zod` | the Pydantic stand-in |
| Env | `dotenv` | holds `OPENAI_API_KEY` |

No vector database. At 30 articles, vectors live in a plain array and similarity is a loop.

---

## 4. The state object (the spine — lock this first)

One object flows through every node. Each node reads some fields, writes others, returns
the whole thing. Nothing else is shared between stages.

```js
/**
 * @typedef {Object} Preferences
 * @property {string[]} topics       // interests to match against
 * @property {string[]} keywords     // optional extra match terms
 * @property {string[]} exclusions   // hard "never include" terms
 *
 * @typedef {Object} Article
 * @property {string}  title
 * @property {string}  url
 * @property {string}  summary        // raw summary from the feed
 * @property {string}  source         // feed name, e.g. "Hacker News"
 * @property {string}  publishedDate
 * @property {number[]=} vec          // embedding (added by scoring stage)
 * @property {string=}  label         // winning interest (added by scoring stage)
 * @property {number=}  score         // relevance score (added by scoring stage)
 * @property {string=}  aiSummary     // 2-3 sentence summary (added by summariser)
 *
 * @typedef {Object} PipelineState
 * @property {string}        rawInput      // the user's preference string
 * @property {Preferences=}  preferences   // set by preference agent
 * @property {Article[]}     articles      // grown/filtered by each stage
 * @property {string=}       newsletter    // final Markdown, set by editor
 */
```

Zod schema for the parts an LLM produces (used to validate its output):

```js
import { z } from "zod";

export const PreferencesSchema = z.object({
  topics:     z.array(z.string()).min(1),
  keywords:   z.array(z.string()),
  exclusions: z.array(z.string()),
});
```

---

## 5. Feeds (fixed list)

```js
// src/feeds.js
export const FEEDS = [
  { name: "Hacker News",   url: "https://news.ycombinator.com/rss" },
  { name: "Guardian Tech", url: "https://www.theguardian.com/uk/technology/rss" },
  { name: "ArXiv CS.AI",   url: "https://arxiv.org/rss/cs.AI" },
  { name: "TechCrunch",    url: "https://techcrunch.com/feed/" },
  { name: "Google News",   url: "https://news.google.com/rss/search?q=artificial+intelligence" },
];
```

---

## 6. Agent contracts

Each agent is one function: `(state) => state`. Contracts below are the whole spec —
implement to match them.

### 6.1 Preference agent — `src/agents/preference.js` (uses LLM)

- **Reads:** `state.rawInput`
- **Writes:** `state.preferences`
- **Behavior:** send `rawInput` to the LLM with a JSON-only system prompt; parse the reply;
  validate with `PreferencesSchema`. Retry once if validation fails.
- **Model:** `gpt-5.4-mini` (bump to `gpt-5.4` only if exclusions slip; volume is 1 call).
- **done-when:** `"AI news, open-source tooling, nothing about crypto"` yields
  `topics` containing AI + open source, and `exclusions` containing `"crypto"`.

### 6.2 Fetcher — `src/agents/fetcher.js` (no AI)

- **Reads:** nothing from state (uses the fixed `FEEDS` list)
- **Writes:** `state.articles`
- **Behavior:** fetch all 5 feeds in parallel (`Promise.allSettled`); a failed feed is
  skipped, not fatal. Normalise every item to the `Article` shape. Trim to 30 total.
- **done-when:** returns up to 30 normalised articles; one dead feed URL does not crash the run.

### 6.3 Relevance scoring — `src/agents/scoring.js` (embeddings + math, no LLM)

- **Reads:** `state.articles`, `state.preferences`
- **Writes:** `state.articles` (filtered, each with `vec`, `label`, `score`)
- **Behavior, in order:**
  1. Drop any article whose `title + summary` contains an exclusion term (cheap, exact).
  2. Embed each interest in `preferences.topics` once.
  3. For each article: embed `title + ". " + summary`, score against every interest with
     cosine similarity, keep the **max**; the winning interest becomes `label`.
  4. Drop articles below `RELEVANCE_THRESHOLD` (start 0.35, tune).
  5. Dedup survivors: drop any whose cosine to an already-kept article is
     ≥ `DEDUP_THRESHOLD` (start 0.85, tune).
- **done-when:** a crypto article is gone after step 1; near-identical stories from two
  feeds collapse to one; every survivor has a `label` and a `score`.

### 6.4 Summariser — `src/agents/summariser.js` (uses LLM)

- **Reads:** surviving `state.articles`
- **Writes:** `article.aiSummary` on each
- **Behavior:** for each article, ask the LLM for a 2-3 sentence summary grounded **only**
  in the supplied `title + summary`. System prompt must forbid outside facts.
- **Model:** `gpt-5.4-mini` (cheap, this is the high-volume call).
- **done-when:** each survivor has a 2-3 sentence `aiSummary` that introduces no facts
  absent from its source text.

### 6.5 Editor — `src/agents/editor.js` (light LLM)

- **Reads:** summarised `state.articles`
- **Writes:** `state.newsletter`
- **Behavior:** group articles by `label`; one LLM call writes a short intro blurb; emit
  Markdown — title, intro, then a `##` section per label with each article as a linked
  headline + its `aiSummary`.
- **done-when:** valid Markdown with one section per topic, every article linked, intro present.

---

## 7. Library helpers

### `src/lib/embeddings.js`
```js
import { pipeline } from "@huggingface/transformers";
let _embed;
async function getEmbedder() {
  _embed ??= await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return _embed;
}
export async function vector(text) {
  const embed = await getEmbedder();
  const out = await embed(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}
export function cosine(a, b) {        // vectors are normalised -> dot product
  return a.reduce((s, x, i) => s + x * b[i], 0);
}
```

### `src/lib/llm.js`
```js
import OpenAI from "openai";
const client = new OpenAI();         // reads OPENAI_API_KEY from env
export async function ask({ model, system, user, maxTokens = 1024 }) {
  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: maxTokens, // GPT-5.x uses this, not max_tokens
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0].message.content;
}
```

---

## 8. Graph wiring — `src/graph.js`

```js
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { preferenceNode } from "./agents/preference.js";
import { fetcherNode }    from "./agents/fetcher.js";
import { scoringNode }    from "./agents/scoring.js";
import { summariserNode } from "./agents/summariser.js";
import { editorNode }     from "./agents/editor.js";

const State = Annotation.Root({
  rawInput:    Annotation(),
  preferences: Annotation(),
  articles:    Annotation(),
  newsletter:  Annotation(),
});

export const app = new StateGraph(State)
  .addNode("preference", preferenceNode)
  .addNode("fetcher",    fetcherNode)
  .addNode("scoring",    scoringNode)
  .addNode("summariser", summariserNode)
  .addNode("editor",     editorNode)
  .addEdge(START, "preference")
  .addEdge("preference", "fetcher")
  .addEdge("fetcher",    "scoring")
  .addEdge("scoring",    "summariser")
  .addEdge("summariser", "editor")
  .addEdge("editor", END)
  .compile();
```

Each `*Node` is just `async (state) => ({ ...state, <field>: <new value> })` wrapping the
agent logic from section 6.

---

## 9. Build order (leaf-first — each step is testable before the next)

1. `lib/embeddings.js` — `vector()` + `cosine()`. Test: two similar sentences score high, two unrelated low.
2. `feeds.js` + `agents/fetcher.js` — get real articles on screen to work against.
3. `agents/preference.js` — verify the parse + exclusions.
4. `agents/scoring.js` — the graded core; tune the two thresholds against real output.
5. `agents/summariser.js` — check grounding.
6. `agents/editor.js` — check the Markdown.
7. `graph.js` + `index.js` — wire and run end to end.
8. Two sample runs with different preferences + the 1-page write-up.

---

## 10. File structure

```
.
├── src/
│   ├── index.js            # entry: read arg, invoke graph, write file
│   ├── graph.js            # StateGraph wiring
│   ├── feeds.js            # fixed feed list
│   ├── state.js            # typedefs + Zod schema
│   ├── lib/
│   │   ├── embeddings.js
│   │   └── llm.js
│   └── agents/
│       ├── preference.js
│       ├── fetcher.js
│       ├── scoring.js
│       ├── summariser.js
│       └── editor.js
├── output/                 # generated newsletters
├── .env                    # OPENAI_API_KEY=...
├── README.md
└── DECISIONS.md            # the 1-page write-up
```

---

## 11. Definition of done (maps to the grading rubric)

- [ ] Five agents, one responsibility each, clean state hand-offs *(architecture — 25%)*
- [ ] Preference parse extracts topics + exclusions correctly *(parsing — 20%)*
- [ ] Exclusions drop banned topics; thresholds filter + dedup sensibly *(relevance — 20%)*
- [ ] Newsletter is clean, grouped, linked Markdown *(output quality — 15%)*
- [ ] README (setup + usage) and DECISIONS.md (scoring justification) *(docs — 15%)*
- [ ] Two sample newsletters from two different preference inputs committed

## 12. For the write-up (DECISIONS.md)

The argument to make: embedding similarity over LLM-per-article because 30 LLM calls per
run is slow and costly, while local embeddings are free and fast; a plain keyword pass
handles hard exclusions that embeddings are too blunt for; and at 30 articles a vector DB
is unnecessary — an in-memory array suffices. Note the two-threshold design (relevance vs
dedup) and the model choice (`gpt-5.4-mini` for the high-volume summaries and the one-shot
preference parse and editor blurb, bumping to `gpt-5.4` only where quality demands it).
