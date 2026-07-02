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
// The embedding model (~129 MB) loads lazily in the background; BM25 answers
// instantly so the bot is usable before the model finishes downloading.
import type { Chunk, Lang, Source } from "./types";

type Index = { model: string; dim: number; built: string; chunks: Chunk[] };

let _index: Promise<Loaded> | null = null;
let _embedder: Promise<(text: string) => Promise<Float32Array>> | null = null;
let _modelReady = false;

type Loaded = {
  meta: Index;
  vectors: Float32Array; // flat, chunks*dim, L2-normalized
  dim: number;
  // BM25
  docTf: Map<string, number>[];
  docLen: number[];
  idf: Map<string, number>;
  avgdl: number;
};

// ── tokenization (accent-folded, stopword-trimmed) ─────────────────────────
const STOP = new Set(
  ("de la el los las un una unos unas y o a en que es del al se su por con para " +
    "the a an of to in is are and or for on with that this it as by be from at " +
    "qué que como cómo cuál cuales donde dónde es son está están").split(" "),
);
const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const tokenize = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9_]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));

function decodeVectors(b64: string): Float32Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

async function loadIndex(): Promise<Loaded> {
  if (_index) return _index;
  _index = (async () => {
    const raw = await fetch("/rag/index.json");
    if (!raw.ok) throw new Error(`index ${raw.status}`);
    const json = (await raw.json()) as Index & { vectors: string };
    const vectors = decodeVectors(json.vectors);
    const dim = json.dim;
    // build BM25
    const docTf: Map<string, number>[] = [];
    const docLen: number[] = [];
    const df = new Map<string, number>();
    for (const c of json.chunks) {
      const toks = tokenize(`${c.embedCtx ? c.embedCtx + " " : ""}${c.title} ${c.text}`);
      const tf = new Map<string, number>();
      for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
      docTf.push(tf);
      docLen.push(toks.length);
    }
    const N = json.chunks.length;
    const idf = new Map<string, number>();
    for (const [t, n] of df) idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
    const avgdl = docLen.reduce((a, b) => a + b, 0) / Math.max(1, N);
    return { meta: json, vectors, dim, docTf, docLen, idf, avgdl };
  })();
  return _index;
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
    });
    _modelReady = true;
    return async (text: string) => {
      const out = await extractor([`query: ${text}`], { pooling: "mean", normalize: true });
      return out.data as Float32Array;
    };
  })();
  return _embedder;
}

export function warmUp() {
  // fire-and-forget: start index + model downloads as soon as the panel opens.
  // Failures are non-fatal (retrieval falls back to BM25) but log them — a
  // silent swallow hides real load problems (CSP, worker, missing assets).
  loadIndex().catch((e) => console.warn("[visabot] index load failed:", e));
  ensureEmbedder().catch((e) => console.warn("[visabot] embed model load failed:", e));
}
export const isModelReady = () => _modelReady;

// ── retrieval ───────────────────────────────────────────────────────────────
const RRF_K = 60;
const POOL = 40; // candidates per modality
const MMR_LAMBDA = 0.7;

function bm25Rank(L: Loaded, qTokens: string[], pool: number[]): { i: number; s: number }[] {
  const k1 = 1.5,
    b = 0.75;
  const scored = pool.map((i) => {
    let s = 0;
    for (const t of qTokens) {
      const f = L.docTf[i].get(t);
      if (!f) continue;
      const idf = L.idf.get(t) || 0;
      s += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * L.docLen[i]) / L.avgdl)));
    }
    return { i, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, POOL);
}

function denseRank(L: Loaded, qv: Float32Array, pool: number[]): { i: number; s: number }[] {
  const d = L.dim;
  const scored = pool.map((i) => {
    let s = 0;
    const off = i * d;
    for (let k = 0; k < d; k++) s += qv[k] * L.vectors[off + k];
    return { i, s };
  });
  return scored.sort((a, b) => b.s - a.s).slice(0, POOL);
}

function cosineIdx(L: Loaded, a: number, b: number): number {
  const d = L.dim;
  let s = 0;
  for (let k = 0; k < d; k++) s += L.vectors[a * d + k] * L.vectors[b * d + k];
  return s;
}

export async function retrieve(query: string, lang: Lang, k = 6): Promise<Source[]> {
  const L = await loadIndex();
  // candidate pool: prefer active language, but fall back to all if sparse
  let pool = L.meta.chunks.map((_, i) => i).filter((i) => L.meta.chunks[i].lang === lang);
  if (pool.length < k * 3) pool = L.meta.chunks.map((_, i) => i);

  const qTokens = tokenize(query);
  const lex = bm25Rank(L, qTokens, pool);

  // dense only if the model is ready (don't block the first answer on a 129MB load)
  let dense: { i: number; s: number }[] = [];
  if (_modelReady && _embedder) {
    try {
      const embed = await _embedder;
      const qv = await embed(query);
      dense = denseRank(L, qv, pool);
    } catch {
      dense = [];
    }
  }

  // Reciprocal Rank Fusion
  const rrf = new Map<number, number>();
  lex.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (RRF_K + r)));
  dense.forEach((x, r) => rrf.set(x.i, (rrf.get(x.i) || 0) + 1 / (RRF_K + r)));
  const fused = [...rrf.entries()].map(([i, s]) => ({ i, s })).sort((a, b) => b.s - a.s);
  if (fused.length === 0) return [];

  // MMR diversification (uses dense vectors for similarity when available)
  const haveVecs = dense.length > 0;
  const selected: number[] = [];
  const cand = fused.slice(0, Math.max(k * 4, 16));
  const maxRel = cand[0].s || 1;
  while (selected.length < k && cand.length) {
    let best = -1,
      bestScore = -Infinity;
    for (let ci = 0; ci < cand.length; ci++) {
      const { i, s } = cand[ci];
      let div = 0;
      if (haveVecs && selected.length)
        div = Math.max(...selected.map((j) => cosineIdx(L, i, j)));
      const score = MMR_LAMBDA * (s / maxRel) - (1 - MMR_LAMBDA) * div;
      if (score > bestScore) {
        bestScore = score;
        best = ci;
      }
    }
    selected.push(cand[best].i);
    cand.splice(best, 1);
  }

  return selected.map((i, idx) => {
    const c = L.meta.chunks[i];
    return { n: idx + 1, title: c.title, source: c.source, url: c.url, text: c.text };
  });
}

// ── generation ────────────────────────────────────────────────────────────────
export type GenResult = { text: string; extractive: boolean };

// stream Claude through the function; onDelta receives incremental text.
export async function generate(
  query: string,
  history: { role: "user" | "assistant"; content: string }[],
  context: Source[],
  lang: Lang,
  onDelta: (t: string) => void,
  signal?: AbortSignal,
  surface: "widget" | "console" = "widget",
): Promise<GenResult> {
  let res: Response;
  try {
    res = await fetch("/.netlify/functions/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang, query, history, context, surface }),
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
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const p of parts) {
      const line = p.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.t === "delta" && ev.text) {
          full += ev.text;
          onDelta(ev.text);
        } else if (ev.t === "error") {
          erred = true;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (erred && !full) return { text: extractive(context, lang), extractive: true };
  return { text: full, extractive: false };
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
