# VisaBot — operating notes

Conversational assistant for the site. A **real, canonical RAG** whose knowledge
is **generated automatically** from the data repo + the site's own academic
content — **no hand-written facts**. See `docs/VISABOT_PLAN.md` for the full
user-story plan. This file is the short operator's manual.

## How it works

```
BUILD (npm run prebuild → build-rag-index.mjs, no API keys)
  • reads content/source.html (ES) + content/en/*.html (EN)  → academic + glossary + references chunks
  • fetches from github.com/UACJ-MIAAD/VisaPredictAI (raw)    → data dictionary, schema, README, queries, roadmap
  • fetches data/processed/bulletins.json                     → live "what changed this month" facts
  • embeds every chunk locally (Transformers.js, multilingual-e5-small q8)
  → public/rag/index.json   (chunks + base64 Float32 vectors)
  → public/rag/suggestions.json (data-derived starter prompts)
  → public/models/…  (self-hosted q8 model, ~129 MB)   ← gitignored, rebuilt each deploy
  → public/ort/…     (self-hosted onnxruntime-web wasm) ← gitignored

RUNTIME (browser, components/visabot/)
  open → load index + (lazy) model → retrieve:
    dense cosine (e5) + sparse BM25  → RRF fusion → MMR diversity → top-6
  → POST {query, history, context, synthetics?} to /.netlify/functions/chat
  → Claude streams a grounded, cited answer ([n] → deep-link to the source section)
  no key / offline → extractive fallback (composes a cited answer from top chunks)
```

BM25 answers instantly; the 129 MB embedding model loads in the background and
upgrades retrieval to hybrid once ready (status pill in the header).

## Canonical sources, cancellation & observability (US I5)

**SSE protocol** (`netlify/functions/chat.mjs`):

```
: ok                                         heartbeat (ignored by the client)
data: {"t":"sources","sources":[{n,title,source,text}]}   ← ALWAYS the first data frame
data: {"t":"delta","text":"…"}               streamed answer tokens (guarded + emoji-stripped)
data: {"t":"truncated","reason":"idle|total"}  only when a server timeout cut the stream
data: {"t":"done"}
data: {"t":"error","code":"…"}               typed errors (see the module header)
```

- **Canonical source list.** The `{t:"sources"}` frame lists **every** source
  that actually entered the grounded prompt — server-rebuilt synthetics (US I1
  descriptors) first, then hash-verified RAG chunks — and nothing else; it is
  emitted even when empty. The client (`mergeServerSources` in
  `use-visabot-chat.ts`) renders **exactly this list**: a chunk the server
  rejected (unknown hash, instructional title/source, oversize) is absent from
  the frame and therefore can never be displayed or cited. Local retrieval
  results only contribute the deep-link URL (matched by identical text). The
  extractive fallback keeps the local list — it is composed client-side from
  those exact chunks, no server prompt involved.
- **Request id.** Every response — success, typed error, even 405 — carries an
  `x-request-id` header (UUID). The same id is the `rid` of the function's
  structured log line, so a user report can be correlated with server-side
  timings without logging any content.
- **Cancellation.** The stop button aborts the browser fetch; the function's
  `ReadableStream.cancel` propagates that abort to the upstream Anthropic
  request (one `AbortController` spans connect + stream), so no tokens keep
  generating for an answer nobody receives. The same controller also fires
  when the code guard blocks (the rest of the stream would be swallowed anyway).
- **Timeouts.** Idle (no upstream bytes) 15 s; total 90 s wall clock
  (`VISABOT_IDLE_MS` / `VISABOT_TOTAL_MS` override them in tests). On timeout
  the partial answer is kept, a visible "incomplete answer" note is appended
  (`truncationNote`), and `{t:"truncated"}` precedes `{t:"done"}`. The client
  marks the message incomplete (stop button does the same via the
  `incomplete` flag on `ChatMessage`).
- **Private metrics.** Client: Plausible events via `track()` — `VisaBot Answer`
  (TTFT/total buckets, retrieval mode bm25/dense, nº of sources, guard /
  fallback / no-sources / truncated flags) and `VisaBot Stop`; the `track()`
  wrapper scrubs free-text-shaped props by construction. Server: one `[chat]`
  JSON log line per request (rid, counts, timings, token usage when the
  upstream reports it, error class) — **never the query**. Full record of what
  is and is not collected: `docs/PRIVACY_RAG.md`. Contracts pinned in
  `tests/chat-stream.test.ts` + `tests/observability.test.ts`.

## Deploy checklist (Netlify)

1. **Set env var** `ANTHROPIC_API_KEY` (Site settings → Environment variables).
   Without it the bot still works in **extractive mode** (cited, no generation).
2. Optional `VISABOT_MODEL` (default `claude-haiku-4-5`) to pick another Claude model.
3. Optional `VISABOT_ALLOWED_ORIGINS` (comma-separated hosts; default
   `visapredictai.com,www.visapredictai.com`). The `chat` function rejects
   requests whose `Origin`/`Referer` isn't allowed (curbs off-site abuse of your
   API credits). Netlify deploy previews (`*.netlify.app`) and localhost are
   always allowed — set this only if your production domain differs.
4. Deploy. `npm run build` runs `build-rag-index.mjs` automatically (prebuild), so
   the knowledge base is regenerated fresh on every deploy — **updates flow in
   without code changes**. The `netlify-plugin-cache` plugin (declared in
   `netlify.toml`) persists `public/models` + `public/ort` across builds so the
   ~129 MB model isn't re-downloaded each deploy (the index is still re-embedded).
5. CSP/Permissions already updated in `netlify.toml` (`wasm-unsafe-eval`,
   `microphone=(self)`; ORT runs on the main thread, no worker-src needed).

### Keep it fresh automatically

The data repo's weekly Action rebuilds `bulletins.json` etc. To have the site
pick that up, add a **Netlify build hook** and call it at the end of that Action
(or rely on the next manual deploy). Each deploy re-downloads the model (~129 MB)
and re-embeds ~590 chunks (~1–2 min) — acceptable at weekly cadence.

## Local commands

```bash
npm run build:rag    # (re)build the index + download model/wasm into public/
npm run rag:check    # Node self-check: probe queries must retrieve the right chunk
npm run rag:smoke    # headless-Chrome e2e: open bot → ask → assert cited answer
npm run build        # full static export (runs build:rag via prebuild)
```

`rag:smoke` runs without an API key, so it exercises retrieval + the extractive
fallback. Live generation only runs once `ANTHROPIC_API_KEY` is set on Netlify.

## Files

| File | Role |
|---|---|
| `scripts/build-rag-index.mjs` | knowledge-engine builder (zero hardcoded facts) |
| `scripts/rag-selfcheck.mjs` · `scripts/visabot-smoke.mjs` | tests |
| `netlify/functions/chat.mjs` | streaming Claude proxy (only secret: `ANTHROPIC_API_KEY`) |
| `components/visabot/{visabot,engine,markdown,types}.{tsx,ts}` | UI + retrieval + render |
| `lib/i18n.ts` (vb* keys) · `components/site-shell.tsx` · `netlify.toml` | wiring |
