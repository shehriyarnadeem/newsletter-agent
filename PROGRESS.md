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
| 2 | Feeds + fetcher | `src/feeds.js`, `src/agents/fetcher.js` | ⬜ next |
| 3 | Preference agent | `src/agents/preference.js` | ⬜ |
| 4 | Relevance scoring | `src/agents/scoring.js` | ⬜ |
| 5 | Summariser | `src/agents/summariser.js` | ⬜ |
| 6 | Editor | `src/agents/editor.js` | ⬜ |
| 7 | Graph + entry | `src/graph.js`, `src/index.js` | ⬜ |
| 8 | Two sample runs + DECISIONS.md write-up | `output/`, `DECISIONS.md`, `README.md` | ⬜ |

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

## Next step

**Step 2 — `src/feeds.js` + `src/agents/fetcher.js`.**
- `feeds.js`: copy the fixed 5-feed list from DESIGN §5 verbatim.
- `fetcher.js`: fetch all 5 in parallel (`Promise.allSettled`), skip failed feeds (not
  fatal), normalize each item to the `Article` shape (title, url, summary, source,
  publishedDate), trim to 30 total.
- done-when: returns up to 30 normalized articles; one dead feed URL does not crash the run.
- Watch for the proxy (fix B) affecting live RSS fetches.
