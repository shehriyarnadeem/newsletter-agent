# Design Decisions

A one-page rationale for the choices that aren't obvious from the code.

## Relevance: local embeddings, not an LLM per article

The core filtering uses **cosine similarity between local embeddings**, not an LLM judgement
per article. With a 30-article pile, an LLM-per-article approach means up to 30 extra calls
every run — slow and costly — to answer a question (“is this on-topic?”) that vector
similarity answers well for free. The `all-MiniLM-L6-v2` model runs locally on CPU, so
scoring is fast and has zero per-article API cost. LLM spend is reserved for where it
actually adds value: parsing the preference string, summarising survivors, and the intro.

## Hard exclusions are a keyword pass, done first

Embeddings are deliberately *fuzzy* — a crypto story can sit at a middling cosine to “AI” and
slip through a similarity threshold. A hard “never include X” rule needs to be exact, so
exclusions are applied as a **cheap case-insensitive substring filter before any embedding**
(`scoring.js` step 1). Trade-off: substring matching is blunt (`"crypto"` would also catch
`"cryptography"`); acceptable for hard user-stated bans, and intentional per the spec.

## No vector database

At a hard cap of 30 articles, vectors live in a plain array and similarity is a `for` loop.
A vector DB (indexing, a service, persistence) would be pure overhead at this scale. If the
cap grew by orders of magnitude, that calculus changes — not here.

## Two thresholds, tuned on real output

Filtering uses **two** separate knobs, because “is it relevant?” and “is it a duplicate?” are
different questions:

- `RELEVANCE_THRESHOLD = 0.30` — keep an article only if its best topic-match cosine ≥ this.
- `DEDUP_THRESHOLD = 0.85` — drop an article if it's ≥ this similar to one already kept
  (the same story syndicated across two feeds).

These were **tuned against live score distributions across two different topic sets**, not
guessed. MiniLM cosines run low even for strong matches (rarely above ~0.55), so the cut sits
near 0.3, not a naive 0.7. The tuning story is itself instructive:

- For an *AI* query, clearly on-topic articles scored ~0.36–0.53 and junk sat below ~0.20 —
  a 0.35 cut looked perfect (~9–13 precise survivors).
- But for a *"startup funding / venture capital"* query, the genuinely-relevant headlines
  ("X raises $30M", "IPO filing") clustered at **0.27–0.34** — abstract financial topic
  phrasings score concrete event headlines lower. At 0.35 that query returned **zero**
  articles: an empty newsletter.

A single fixed threshold is therefore topic-dependent, and 0.35 was overfit to the first
query. **0.30 is the robust compromise**: still mostly precise (off-topic noise sits well
below 0.20), but it doesn't collapse a reasonable query to nothing. The design still favours
precision, just not so aggressively that it becomes brittle. A future improvement would be a
relative cut (e.g. keep the top-N or everything within X of the best score) instead of an
absolute one.

## Model choice

All calls use **`gpt-5.4-mini`**: the high-volume per-article summaries, the one-shot
preference parse, and the editor's intro blurb. Mini is cheap and the volume driver is the
summaries; the bigger `gpt-5.4` is held in reserve only if the preference parse ever slips on
exclusions (it hasn't).

## Smaller calls

- **Fetcher interleave** — feeds are merged round-robin (one from each, repeat) before the
  30-cap, so a high-volume feed like Hacker News can't drain the cap and starve the others.
  A naive `slice(0, 30)` would have produced an all-HN newsletter.
- **Grounded summaries** — the summariser prompt forbids facts not in the source text, which
  matters for feeds (e.g. Hacker News) whose RSS body is empty; for those, it restates the
  title rather than inventing detail.
