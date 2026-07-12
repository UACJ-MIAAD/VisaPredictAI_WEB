// VisaBot · retrieval + generation engine (Épicas B & C, client side).
//
// Canonical RAG, all in the browser except generation:
//   • dense retrieval  — cosine over self-hosted multilingual-e5-small (q8)
//   • sparse retrieval — BM25 Okapi (built on load, instant, model-free)
//   • fusion           — Reciprocal Rank Fusion (RRF)
//   • diversity        — Maximal Marginal Relevance (MMR)
//   • generation       — Claude via /.netlify/functions/chat (streamed)
//   • graceful fallback— extractive answer from top chunks when no LLM key
//
// The embedding model (~129 MB) + ORT wasm (~23 MB) download ONLY after an
// explicit user gesture (warmUpSemantic); warmUp loads just the lightweight
// index + BM25, so the bot is instantly usable — and stays usable — without
// the semantic engine (AZ1: no ~150 MB download without consent).
import type { Chunk, Lang, ServerSource, Source, SyntheticDescriptor } from "./types";
import { buildBM25, decodeF16, retrieveRanked } from "@/lib/visabot/retrieval-core.mjs";

// US I6 — layered index. chunks.json (small, no vectors) loads on warmUp and
// powers BM25; vectors.f16 (raw float16) downloads ONLY after the semantic
// consent, alongside the model. The old monolithic index.json still exists but
// is an EVAL artifact (rag-golden-eval / rag-eval probe it) — the browser
// never fetches it anymore.
type Index = { schema?: number; model: string; dim: number; chunks: Chunk[] };

let _index: Promise<Loaded> | null = null;
let _vectors: Promise<Float32Array> | null = null;
let _vectorsReady: Float32Array | null = null;
let _embedder: Promise<(text: string) => Promise<Float32Array>> | null = null;
let _modelReady = false;
// download progress (0–100) for the semantic engine, aggregated across model files
let _dlProgress = 0;
const _dlFiles = new Map<string, { loaded: number; total: number }>();

type Loaded = {
  meta: Index;
  dim: number;
  // BM25
  docTf: Map<string, number>[];
  docLen: number[];
  idf: Map<string, number>;
  avgdl: number;
};

// tokenization + BM25/RRF/MMR live in the shared retrieval-core.mjs (imported
// above) so the three rag-*.mjs evals rank identically to production.

async function loadIndex(): Promise<Loaded> {
  if (_index) return _index;
  _index = (async () => {
    const raw = await fetch("/rag/chunks.json");
    if (!raw.ok) throw new Error(`chunks ${raw.status}`);
    const json = (await raw.json()) as Index;
    const { docTf, docLen, idf, avgdl } = buildBM25(json.chunks);
    return { meta: json, dim: json.dim, docTf, docLen, idf, avgdl };
  })();
  return _index;
}

// post-consent only: the dense layer (raw f16, decoded with the SAME shared
// codec the build round-tripped through, so scores match the evals bit-for-bit)
function ensureVectors(): Promise<Float32Array> {
  if (_vectors) return _vectors;
  _vectors = (async () => {
    const res = await fetch("/rag/vectors.f16");
    if (!res.ok) throw new Error(`vectors ${res.status}`);
    const vecs = decodeF16(new Uint8Array(await res.arrayBuffer())) as Float32Array;
    _vectorsReady = vecs;
    return vecs;
  })();
  return _vectors;
}

// kick off model load in the background; resolves a query→vector fn
function ensureEmbedder(): Promise<(text: string) => Promise<Float32Array>> {
  if (_embedder) return _embedder;
  _embedder = (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.allowRemoteModels = false; // self-hosted only
    env.allowLocalModels = true;
    env.localModelPath = "/models/";
    const onnx = env.backends?.onnx as
      | { wasm?: { wasmPaths?: string; numThreads?: number; proxy?: boolean } }
      | undefined;
    if (onnx?.wasm) {
      onnx.wasm.wasmPaths = "/ort/";
      onnx.wasm.numThreads = 1; // no cross-origin isolation → single thread
      onnx.wasm.proxy = false; // main thread: the worker path hangs under our bundling/CSP
    }
    const extractor = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", {
      dtype: "q8",
      progress_callback: (p) => {
        // ProgressInfo is a union; only the download variants carry file/total
        if ("file" in p && "total" in p && typeof p.total === "number") {
          const loaded = "loaded" in p && typeof p.loaded === "number" ? p.loaded : 0;
          _dlFiles.set(p.file, { loaded, total: p.total });
        }
        let loaded = 0, total = 0;
        for (const f of _dlFiles.values()) { loaded += f.loaded; total += f.total; }
        if (total > 0) _dlProgress = Math.min(99, Math.round((loaded / total) * 100));
      },
    });
    _modelReady = true;
    _dlProgress = 100;
    return async (text: string) => {
      const out = await extractor([`query: ${text}`], { pooling: "mean", normalize: true });
      return out.data as Float32Array;
    };
  })();
  return _embedder;
}

export function warmUp() {
  // fire-and-forget: load the BM25 layer (chunks.json, no vectors) as soon as
  // the panel opens. Deliberately does NOT touch the embedding model OR the
  // dense vectors — those download only with consent (see warmUpSemantic).
  loadIndex().catch((e) => console.warn("[visabot] index load failed:", e));
}

export function warmUpSemantic() {
  // user-gesture only: start the semantic engine download (~113 MB model +
  // ~17 MB tokenizer + ~23 MB ORT wasm + the f16 vector layer). Failures are
  // non-fatal (retrieval falls back to BM25) but log them — a silent swallow
  // hides real load problems (CSP, worker, missing assets).
  loadIndex().catch((e) => console.warn("[visabot] index load failed:", e));
  ensureVectors().catch((e) => console.warn("[visabot] vector layer load failed:", e));
  ensureEmbedder().catch((e) => console.warn("[visabot] embed model load failed:", e));
}

export const isModelReady = () => _modelReady;
// 0–100 download progress of the semantic engine (for the loading pill)
export const downloadProgress = () => _dlProgress;
// whether the semantic download has been started (this page load)
export const isSemanticStarted = () => _embedder !== null;

// ── retrieval ───────────────────────────────────────────────────────────────
// The whole pipeline (expand → cross-lingual pool → BM25 + dense → RRF → rerank
// → MMR) lives in the shared retrieval-core.mjs so the three rag-*.mjs evals
// rank byte-identically to this path.

export async function retrieve(query: string, lang: Lang, k = 6): Promise<Source[]> {
  const L = await loadIndex();
  // dense only if the model AND the vector layer are ready (don't block the
  // first answer on the consent download; BM25 answers instantly meanwhile)
  let qv: Float32Array | null = null;
  if (_modelReady && _embedder && _vectorsReady) {
    try {
      qv = await (await _embedder)(query);
    } catch {
      qv = null;
    }
  }
  const { selected } = retrieveRanked({
    chunks: L.meta.chunks,
    // with qv=null the pipeline never touches vectors (no dense pass, MMR runs
    // score-only), so the empty array is inert pre-consent
    vectors: _vectorsReady ?? new Float32Array(0),
    dim: L.dim,
    bm25: { docTf: L.docTf, docLen: L.docLen, idf: L.idf, avgdl: L.avgdl },
    query,
    qv,
    lang,
    k,
  });
  return selected.map((i: number, idx: number) => {
    const c = L.meta.chunks[i];
    return { n: idx + 1, title: c.title, source: c.source, url: c.url, text: c.text };
  });
}

// ── generation ────────────────────────────────────────────────────────────────
// serverSources: the server-rebuilt synthetic sources ({t:"sources"} first SSE
// frame, US I1) — what ACTUALLY grounded the answer; the hook swaps them into
// the message's displayed sources.
export type GenResult = { text: string; extractive: boolean; serverSources?: ServerSource[] };

// stream Claude through the function; onDelta receives incremental text.
export async function generate(
  query: string,
  history: { role: "user" | "assistant"; content: string }[],
  context: Source[],
  lang: Lang,
  onDelta: (t: string) => void,
  signal?: AbortSignal,
  surface: "widget" | "console" = "widget",
  synthetics?: SyntheticDescriptor[],
): Promise<GenResult> {
  let res: Response;
  try {
    res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lang,
        query,
        history,
        // US I1 (#30): synthetic grounding text NEVER travels to the server —
        // only hash-verified RAG chunks go as context; the chart grounding goes
        // as structured descriptors and the server rebuilds the text itself
        // from verified release data.
        context: context.filter((s) => !s.synthetic),
        ...(synthetics?.length ? { synthetics } : {}),
        surface,
      }),
      signal,
    });
  } catch {
    return { text: extractive(context, lang), extractive: true };
  }

  if (res.status === 503 || !res.ok || !res.body) {
    // no key / unavailable → honest extractive answer
    return { text: extractive(context, lang), extractive: true };
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "",
    full = "",
    erred = false;
  let serverSources: ServerSource[] | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // Runaway guard: a malformed stream with no frame boundary must not grow the
    // buffer without bound — bail to the extractive fallback instead.
    if (buf.length > 1_000_000) {
      erred = true;
      break;
    }
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const p of parts) {
      // an SSE event may carry MULTIPLE data: lines that concatenate
      const payload = p.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
      if (!payload) continue;
      try {
        const ev = JSON.parse(payload);
        if (ev.t === "delta" && ev.text) {
          full += ev.text;
          onDelta(ev.text);
        } else if (ev.t === "sources" && Array.isArray(ev.sources)) {
          serverSources = ev.sources as ServerSource[]; // US I1: server-rebuilt synthetics
        } else if (ev.t === "error") {
          erred = true;
        }
      } catch {
        /* ignore ping / keep-alive */
      }
    }
  }
  if (erred && !full) return { text: extractive(context, lang), extractive: true };
  return { text: full, extractive: false, serverSources };
}

// extractive fallback: compose a grounded answer from the top chunks, cited.
export function extractive(context: Source[], lang: Lang): string {
  if (!context.length)
    return lang === "en"
      ? "Hi — I'm **VisaBot**. Ask me about the U.S. Visa Bulletin, the multi-series data panel, or the models and CRISP-DM methodology."
      : "Hola — soy **VisaBot**. Pregúntame sobre el U.S. Visa Bulletin, el panel multiserie de datos, o los modelos y la metodología CRISP-DM.";
  const intro =
    lang === "en"
      ? "_Answering from the project's documentation (live assistant offline):_"
      : "_Respondo desde la documentación del proyecto (asistente en vivo no disponible):_";
  const body = context
    .slice(0, 3)
    .map((s) => {
      const t = s.text.length > 480 ? s.text.slice(0, 480).replace(/\s+\S*$/, "") + "…" : s.text;
      return `**${s.title}** [${s.n}]\n\n${t}`;
    })
    .join("\n\n");
  return `${intro}\n\n${body}`;
}
