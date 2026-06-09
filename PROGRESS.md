# Build Progress / Handoff — Newsletter Agent

> Working notes for resuming the build. **DESIGN.md is the source of truth** for the spec;
> this file only tracks state, environment fixes, and what to do next.
> Last updated: 2026-06-08.

---

## How to resume

1. Re-read `DESIGN.md` — Section 0 (ground rules) every time, build in Section 9 order,
   one file at a time, run each **done-when** before moving on.
2. Skim the "Environment fixes" section below — two machine-specific blockers are already
   solved but can recur after a dependency reinstall.
3. Continue from the "Next step" pointer at the bottom.

---

## Build order status (DESIGN §9)

| # | Step | Files | Status |
|---|------|-------|--------|
| 1 | Embeddings helper | `src/lib/embeddings.js` | ✅ **DONE — done-when PASS** |
| 2 | Feeds + fetcher | `src/feeds.js`, `src/agents/fetcher.js` | ✅ **DONE — done-when PASS** |
| 3 | Preference agent | `src/agents/preference.js` | ✅ **DONE — done-when PASS** |
| 4 | Relevance scoring | `src/agents/scoring.js` | ✅ **DONE — done-when PASS** |
| 5 | Summariser | `src/agents/summariser.js` | ✅ **DONE — done-when PASS** |
| 6 | Editor | `src/agents/editor.js` | ✅ **DONE — done-when PASS** |
| 7 | Graph + entry | `src/graph.js`, `src/index.js` | ✅ **DONE — done-when PASS** |
| 8 | Two sample runs + DECISIONS.md write-up | `output/`, `DECISIONS.md`, `README.md` | ✅ **DONE** |

Also still to create per DESIGN §10: `src/state.js` (typedefs + Zod schema), `.env`, `README.md`.

---

## What exists on disk now

- `package.json` — ESM (`"type": "module"`), deps installed. Exact packages per DESIGN §3:
  `@langchain/langgraph`, `@huggingface/transformers` (NOT `@xenova/transformers`),
  `openai`, `rss-parser`, `zod`, `dotenv`.
- `node_modules/` — installed (125 pkgs). Node version on machine: **v24.16.0**.
- `src/lib/embeddings.js` — `vector()` + `cosine()`, verbatim from DESIGN §7. Verified.
- `src/lib/`, `src/agents/`, `output/` directories created.
- DESIGN.md — the spec.

> Note: a temporary `test-embeddings.js` was used to run Step 1's done-when, then deleted
> (not part of DESIGN §10). Done-when checks are run as throwaway scripts, not committed.

---

## Step 1 result (embeddings.js done-when)

- "AI/ML" vs "deep learning/neural networks" → cosine **0.6492** (high)
- "AI/ML" vs "chocolate cake recipes" → cosine **0.1369** (low)
- Clear margin → PASS. (MiniLM rarely exceeds ~0.7 for related-but-not-identical text;
  the >0.7 bar in the first scratch test was too strict and was corrected.)

---

## Environment fixes already applied (machine-specific — NOT in DESIGN.md)

### A. Visual C++ Redistributable was missing → onnxruntime-node wouldn't load
- Symptom: `Error: ... onnxruntime_binding.node ... The specified module could not be
  found` even though the .node file exists. Real cause: missing VCRUNTIME140.dll /
  VCRUNTIME140_1.dll / MSVCP140.dll.
- Fix (done once, needs admin/UAC):
  `winget install --id Microsoft.VCRedist.2015+.x64 -e --source winget --accept-source-agreements --accept-package-agreements --disable-interactivity`
- Status: ✅ installed. Only redo on a fresh machine.

### C. (Linux machine) HN + Google News feeds hang → AggregateError ETIMEDOUT
- Symptom: `parser.parseURL` on `news.ycombinator.com/rss` and `news.google.com/rss/...`
  throws `AggregateError [ETIMEDOUT]` (empty message), while curl reaches both fine. Node's
  Happy-Eyeballs dual-stack races IPv6+IPv4; broken IPv6 routing on this network makes those
  two hosts time out (the other 3 feeds resolve cleanly).
- Fix (in `src/agents/fetcher.js` Parser opts): `requestOptions: { family: 4 }` forces IPv4.
  Also set `maxRedirects: 5` (Google News 302-redirects to the real feed) and a browser
  `User-Agent`.
- Status: ✅ all 5 feeds return; balanced 6 each = 30 articles.

### B. Corporate proxy breaks transformers.js model download → 0-byte model.onnx
- Symptom: `Load model from ...\model.onnx failed:system error number 13`. The model file
  is **0 bytes**. transformers.js `fetch` does not pass proxy/NTLM credentials, so the
  ~90 MB `onnx/model.onnx` silently downloads empty (small config/tokenizer files slip
  through).
- Fix: download manually with PowerShell (honors system proxy + default creds), drop into
  the transformers cache:
  ```powershell
  $wc = New-Object System.Net.WebClient
  $wc.UseDefaultCredentials = $true
  $wc.Proxy = [System.Net.WebRequest]::GetSystemWebProxy()
  $wc.Proxy.Credentials = [System.Net.CredentialCache]::DefaultNetworkCredentials
  $wc.DownloadFile("https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model.onnx",
    "node_modules\@huggingface\transformers\.cache\Xenova\all-MiniLM-L6-v2\onnx\model.onnx")
  ```
- Status: ✅ model present (90,387,606 bytes).
- ⚠️ The cache lives under `node_modules` — any `npm install` / `npm ci` wipes it. Re-run
  the manual download after reinstalling deps.
- ⚠️ The same proxy will likely affect Step 2 (live RSS fetches via `rss-parser`) and any
  OpenAI calls. For RSS, plan to pass a custom requestOptions/agent with default creds if
  feeds fail. For OpenAI, `OPENAI_API_KEY` goes in `.env` (still to be created); proxy may
  need `HTTPS_PROXY` env or a custom fetch.

---

## Open items / decisions pending

- `.env` with `OPENAI_API_KEY` not yet created (needed for Steps 3, 5, 6, 7).
- Confirm whether OpenAI traffic must route through the proxy (likely yes on this network).
- Model strings per DESIGN: `gpt-5.4-mini` for all calls, bump to `gpt-5.4` only if the
  preference parse slips on exclusions.

---

## BUILD COMPLETE — all 8 steps done (2026-06-09)

Nothing left to build. Remaining is the user's call: review + `git commit`.

### Step 8 result
- `README.md` + `DECISIONS.md` written.
- Two committed samples in `output/`: `sample-1-ai-opensource.md` (13 articles, 2 sections),
  `sample-2-startups-vc.md` (4 articles, 2 sections). `output/` un-gitignored so they commit.
- Summariser "Comments"-artifact prompt tweak: APPLIED (0 leaks in both samples).
- **THRESHOLD CHANGED 0.35 → 0.30** (`scoring.js`). The startups/VC query returned ZERO at
  0.35 (relevant funding headlines clustered 0.27–0.34; abstract topics score concrete
  headlines lower). 0.30 is topic-robust and keeps both samples clean. Documented in
  DECISIONS.md. Re-verify if feeds/topics change.

### Known environment quirk (for future runs)
- `node src/index.js` can linger a few seconds after printing before the process exits
  (onnxruntime threads); it does exit cleanly (exit 0). When scripting runs, match the real
  process with `pgrep -x node`, NOT `pgrep -f "index.js"` (the latter also matches the bash
  wrapper's command line and will hang a wait-loop).

### Step 7 result (graph + index done-when) — PASS
- `node src/index.js "..."` (plain, no --env-file — `import "dotenv/config"` is first line)
  ran the compiled graph: 30 → 12 survivors → 12 summaries → 2 sections; wrote
  `output/newsletter-<ts>.md` (5.8 KB) and printed it.
- Confirmed Annotation channels pass preferences/articles/newsletter through correctly via
  `app.invoke`.

### Step 6 result (editor done-when) — PASS
- Structurally validated: 1 title, N `##` sections = N labels, every article a `### [..](..)`
  link (10/10), intro present. Valid grouped+linked Markdown.
- ONE LLM call (intro blurb only); grouping + Markdown assembly are deterministic code.
- ⚠️ POLISH ITEM (summariser, not editor): for HN "Comments"-only items the summary
  sometimes leaks the artifact ("...contains only the word 'Comments'..."). Optional prompt
  tweak: forbid mentioning the raw summary / missing info; just restate the title.

### Step 5 result (summariser done-when) — PASS
- All 10 survivors got a 2-3 sentence `aiSummary`. Grounding verified on the hardest cases:
  HN/Google items whose `summary` is just "Comments" or a repeated title → the model
  restated the title and said "no additional details" rather than inventing. Anti-
  hallucination prompt works.
- Concurrency: `Promise.all` over survivors (OpenAI client is parallel-safe, unlike the
  single shared embedder in scoring).

### Step 4 result (scoring done-when) — PASS
- Embeddings model loads on Linux ✅ (384-dim; related 0.53 vs unrelated 0.20; first load
  ~47s incl. ~90 MB download, cached after).
- Controlled test: crypto dropped at keyword step; two near-identical stories collapsed to
  one; every survivor has label + score.
- **Thresholds tuned against live data** and kept at defaults: `RELEVANCE_THRESHOLD = 0.35`,
  `DEDUP_THRESHOLD = 0.85`. Live distribution: clearly-relevant articles score 0.36–0.53;
  junk (off-topic) sits <0.20; 0.35 yields ~9–10 precise survivors. Precision-first choice
  for a newsletter (lowering to 0.30 adds recall but arXiv/borderline noise). → DECISIONS.md.
- Note: preference parse is mildly non-deterministic ("AI" vs "AI news"), nudging scores
  ±, so survivor count wobbles ±1 between runs.

### Step 3 result (preference done-when) — PASS
- `"AI news, open-source tooling, nothing about crypto"` → topics `['AI news',
  'open-source tooling']`, exclusions `['crypto']`. No retry needed.
- Created `src/state.js` (Zod `PreferencesSchema`) + `src/lib/llm.js` (`ask()` wrapper).
- Smoke-tested live: key works, `gpt-5.4-mini` valid on this account.

### Dev tooling added (gitignored, not part of deliverable)
- `dev/run.mjs` — living harness: runs the pipeline and pretty-prints state after each
  stage. Uncomment a stage's block as it's built. Run: `node --env-file=.env dev/run.mjs`.
- `.vscode/launch.json` — debugger configs (breakpoints, F5). Auto-loads `.env`.

### Step 2 result (fetcher done-when) — PASS
- 30 articles, balanced 6 per feed across all 5; injected dead feed skipped, no crash.
- Note: HN RSS `summary` is just `"Comments"` (no body) — HN items rely on title alone for
  scoring/summarising.
