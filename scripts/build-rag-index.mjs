// ─────────────────────────────────────────────────────────────────────────
// VisaBot — knowledge-engine builder (Épica A of docs/VISABOT_PLAN.md).
//
// Builds a REAL, canonical RAG index with ZERO hand-written facts. Every chunk
// comes from a live source:
//   1. The site's own academic content   (content/source.html + content/en/*.html)
//   2. Docs from the data repo via GitHub raw — PINNED at the release git SHA
//      (US I6: resolved from the release manifest; `main` only as documented
//      fallback when the manifest is unreachable)
//   3. Live facts from data/processed/bulletins.json (latest month movements —
//      deliberately fetched from `main`: it is the freshness feed)
//
// Output (gitignored, regenerated each build → updates flow automatically):
//   public/rag/index.json        chunks + dense vectors (base64 f32) — the EVAL
//                                monolith: rag-golden-eval / rag-selfcheck /
//                                rag-eval / rag-injection-eval read this file.
//                                The BROWSER no longer downloads it (US I6).
//   public/rag/chunks.json       chunks WITHOUT vectors (BM25 layer) — what the
//                                client loads on warmUp, pre-consent. Byte-
//                                reproducible (no timestamp).
//   public/rag/vectors.f16       raw little-endian float16 vectors — loaded
//                                ONLY after semantic consent. The build round-
//                                trips the f32 embeddings through f16 so the
//                                monolith (evals) and this file carry BIT-
//                                IDENTICAL values (no production/eval drift).
//   public/rag/meta.json         build heartbeat + governance + source/model
//                                pins + per-layer content hashes.
//   public/rag/suggestions.json  data-derived starter prompts (ES/EN)
//   public/models/<model>/…       self-hosted embedding model (CSP-clean),
//                                sha256-verified against MODEL_PIN every build.
//
// No API keys needed: embeddings are computed locally with Transformers.js.
// Network failures degrade gracefully (local content always yields an index).
// Run: npm run build:rag   (also runs in `prebuild`)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { DATA_REPO_RAW as REPO_RAW, dataRepoRawAt } from "../lib/repo.mjs";
import { MANIFEST_PATH } from "../lib/release.mjs";
import { encodeF16, decodeF16 } from "../lib/visabot/retrieval-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const EMBED_MODEL = "Xenova/multilingual-e5-small";
const EMBED_DIM = 384;
const CHUNK_CHARS = 900; // target chunk size
const CHUNK_OVERLAP = 150;

// ── model pin (US I6) ────────────────────────────────────────────────────────
// revision = the HF repo commit the self-hosted copy was taken from; files =
// sha256 of every file the q8 pipeline loads. VERIFIED at build after the
// pipeline ran (fresh CI download or cached copy alike): any drift fails the
// build loudly — a silently swapped embedding model would skew every vector.
// DOCUMENTED LIMIT: the revision is metadata, not a loader argument — passing
// `revision` to transformers.js would change its cache layout away from the
// plain public/models/<model>/ tree the BROWSER resolves (engine.ts,
// allowRemoteModels=false), so integrity is enforced by these sha256 pins at
// build; at runtime the trust boundary is same-origin hosting + the atomic
// Netlify deploy (no per-fetch hash hook exists inside transformers.js).
// Refresh: recompute `shasum -a 256` over public/models/<model>/** and update.
const MODEL_PIN = {
  name: EMBED_MODEL,
  revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
  files: {
    "config.json": "cb99455288675345e1a4f411438d5d0adbba5fbd3a67ea4fb03c015433b996c1",
    "tokenizer.json": "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
    "tokenizer_config.json": "a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b",
    "onnx/model_quantized.onnx": "f80102d3f2a1229f387d3c81909990d8945513e347b0eab049f7de3c6f98c193",
  },
};

// ── data-repo source pin (US I6) ────────────────────────────────────────────
// RAG docs are read at the release manifest's git_sha instead of `main`, so the
// indexed knowledge is attributable to ONE repo state and a rebuild reads the
// same bytes. The pin cross-checks lib/content/data-pins.generated.mjs (US I1:
// the release actually SERVED under /data) — `coherent: true` means docs and
// data describe the same release; a mismatch is recorded, never hidden.
const sourcePin = {
  ref: "main", // effective fetch ref: git_sha when resolved, else main (documented fallback)
  git_sha: null,
  release_id: null,
  generated_at: null,
  served_release_id: null,
  served_release_status: null,
  coherent: false,
  fallbacks: [], // docs that had to fall back to main (missing at the pinned SHA)
};
async function resolveSourcePin() {
  try {
    const { DATA_PINS } = await import("../lib/content/data-pins.generated.mjs");
    sourcePin.served_release_id = DATA_PINS?.releaseId ?? null;
    sourcePin.served_release_status = DATA_PINS?.releaseStatus ?? null;
  } catch {
    console.warn("  ! data-pins.generated.mjs not built yet (run build-stats) — served-release cross-check skipped");
  }
  try {
    const r = await fetch(`${REPO_RAW}/${MANIFEST_PATH}`);
    if (!r.ok) throw new Error(`${r.status}`);
    const m = await r.json();
    if (m.git_sha) {
      sourcePin.ref = m.git_sha;
      sourcePin.git_sha = m.git_sha;
      sourcePin.release_id = m.release_id ?? null;
      sourcePin.generated_at = m.generated_at ?? null;
      sourcePin.coherent = !!sourcePin.served_release_id && sourcePin.served_release_id === sourcePin.release_id;
      console.log(
        `  source pin: docs @ ${m.git_sha} (release ${m.release_id})` +
          (sourcePin.coherent ? " — coherent with served /data cut" : ` — served cut is ${sourcePin.served_release_id ?? "n/d"} (recorded, not hidden)`),
      );
      return;
    }
    throw new Error("manifest has no git_sha");
  } catch (e) {
    console.warn(`  ! release manifest unavailable (${e.message}) — docs fall back to main (unpinned, recorded in meta.json)`);
  }
}

// ── tiny HTML/markdown → text helpers ──────────────────────────────────────
const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&[a-z]+;/gi, " ");

const stripTags = (html) =>
  decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|table|ul|ol|br)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/gm, "")
    .trim();

// ── deep-link map: sectionId → site route (parsed from site-map, not hardcoded)
function buildSectionRoutes() {
  const sm = readFileSync(join(root, "lib", "site-map.ts"), "utf8");
  const map = {};
  for (const block of sm.split(/path:\s*"/).slice(1)) {
    const path = block.slice(0, block.indexOf('"'));
    for (const m of block.matchAll(/id:\s*"([^"]+)"/g)) map[m[1]] = path;
  }
  return map;
}
const SECTION_ROUTE = buildSectionRoutes();
const localePath = (path, lang) =>
  lang === "en" ? (path === "/" ? "/en" : `/en${path}`) : path;
const sectionUrl = (id, lang) =>
  `${localePath(SECTION_ROUTE[id] || "/", lang)}#${id}`;

// ── chunkers ────────────────────────────────────────────────────────────────
function splitByLength(text, title) {
  const out = [];
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let buf = "";
  const flush = () => {
    const t = buf.trim();
    if (t.length > 40) out.push(t);
    buf = "";
  };
  const carryOverlap = () => {
    // carry the tail of the just-flushed chunk into the next for continuity
    const prev = out[out.length - 1] || "";
    return prev.slice(-CHUNK_OVERLAP);
  };
  for (const p of paras) {
    if (buf.length + p.length + 2 > CHUNK_CHARS && buf) {
      flush();
      buf = carryOverlap() + "\n\n";
    }
    if (p.length > CHUNK_CHARS) {
      // hard-split very long paragraphs on sentence boundaries. The final
      // alternative is `[^.!?]+$` (NOT `\S+$`): the old form matched only the
      // last whitespace-delimited TOKEN of a punctuation-free tail, silently
      // dropping the rest — e.g. a whole CREATE TABLE DDL after a comment's
      // period became unretrievable (finding 1).
      const sents = p.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [p];
      for (const s of sents) {
        if (buf.length + s.length > CHUNK_CHARS && buf) {
          flush();
          buf = carryOverlap() + " "; // keep 150-char overlap on the sentence-split path too (finding 15)
        }
        buf += s + " ";
      }
    } else {
      buf += p + "\n\n";
    }
  }
  flush();
  return out.map((text, i) => ({ title: out.length > 1 ? `${title} (${i + 1}/${out.length})` : title, text }));
}

// ── I4 ablation variant: semantic (sentence-boundary) chunker ────────────────
// Selected with VB_CHUNK=semantic (ablation builds only — NOT the default; see
// docs/VISABOT_RAG_ROADMAP.md for the measured decision). Packs WHOLE sentences
// up to CHUNK_CHARS (never cuts mid-sentence, unlike splitByLength's char-tail
// overlap), overlap = the last full sentence when it fits CHUNK_OVERLAP, and
// carries parent/ordinal/character-offset metadata per chunk.
function splitBySentences(text, title) {
  const sents = [];
  const re = /[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g;
  let m;
  while ((m = re.exec(text))) {
    const t = m[0].trim();
    if (t) sents.push({ t, start: m.index, end: m.index + m[0].length });
  }
  const packs = [];
  let cur = [], curLen = 0;
  const flush = () => {
    if (!cur.length) return;
    const body = cur.map((s) => s.t).join(" ");
    if (body.length > 40) packs.push({ text: body, start: cur[0].start, end: cur[cur.length - 1].end });
    cur = []; curLen = 0;
  };
  for (const s of sents) {
    if (curLen + s.t.length + 1 > CHUNK_CHARS && cur.length) {
      const lastSent = cur[cur.length - 1];
      flush();
      if (lastSent.t.length <= CHUNK_OVERLAP) { cur = [lastSent]; curLen = lastSent.t.length; } // sentence-overlap
    }
    cur.push(s); // an oversized single sentence ships alone rather than being cut
    curLen += s.t.length + 1;
  }
  flush();
  return packs.map((c, i) => ({
    title: packs.length > 1 ? `${title} (${i + 1}/${packs.length})` : title,
    text: c.text,
    parent: title,
    ordinal: i,
    span_start: c.start,
    span_end: c.end,
  }));
}

// active chunker for prose (baseline unless the ablation env is set)
const chunkText = process.env.VB_CHUNK === "semantic" ? splitBySentences : splitByLength;

// split an HTML section into [{heading, html}] by h2/h3/h4 boundaries
function splitByHeadings(html) {
  const parts = [];
  const re = /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let last = 0, m, heading = null;
  while ((m = re.exec(html))) {
    if (heading !== null || m.index > last)
      parts.push({ heading, html: html.slice(last, m.index) });
    heading = stripTags(m[2]);
    last = re.lastIndex;
  }
  parts.push({ heading, html: html.slice(last) });
  return parts.filter((p) => stripTags(p.html).length > 20 || p.heading);
}

// ── chunk collectors (each returns chunk objects without vectors) ────────────
const chunks = [];
let nextId = 0;
const add = (c) => chunks.push({ id: `c${nextId++}`, ...c });

function addSectionHtml(id, sectionLabel, html, lang) {
  const url = sectionUrl(id, lang);
  // US I6 chunk metadata: the site's academic content is the FROZEN proposal
  // (source_type "site_academic"); it carries no data-release identity.
  const meta = { source_type: "site_academic" };
  // glossary: one atomic chunk per term
  if (/gloss-item/.test(html)) {
    for (const g of html.matchAll(/<div class="gloss-item"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g)) {
      const term = (g[1].match(/gloss-term"[^>]*>([\s\S]*?)<\/div>/) || [, ""])[1];
      const def = (g[1].match(/gloss-def"[^>]*>([\s\S]*?)$/) || [, g[1]])[1];
      const t = stripTags(term), d = stripTags(def);
      if (t && d) add({ lang, kind: "glossary", ...meta, source: sectionLabel, sourceId: id, url, title: t, text: `${t}: ${d}` });
    }
    return;
  }
  // references: one atomic chunk per IEEE entry
  if (/ref-item/.test(html)) {
    for (const r of html.matchAll(/<li class="ref-item"[^>]*data-n="(\d+)"[^>]*>([\s\S]*?)<\/li>/g)) {
      const txt = stripTags(r[2]);
      if (txt) add({ lang, kind: "reference", ...meta, source: sectionLabel, sourceId: id, url, title: `[${r[1]}]`, text: txt });
    }
    return;
  }
  // general academic prose: split by headings → length-chunk each
  for (const part of splitByHeadings(html)) {
    const text = stripTags(part.html);
    if (text.length < 40) continue;
    const title = part.heading || sectionLabel;
    for (const ch of chunkText(text, title))
      add({ lang, kind: "academic", ...meta, source: sectionLabel, sourceId: id, url, ...chunkMeta(ch), title: ch.title, text: ch.text });
  }
}

function addMarkdown(name, md, sourceUrl, langs = ["es"], extra = {}) {
  // split markdown by ##/### headings
  const blocks = [];
  const re = /^#{1,4}\s+(.+)$/gm;
  let last = 0, m, heading = name;
  while ((m = re.exec(md))) {
    blocks.push({ heading, body: md.slice(last, m.index) });
    heading = m[1].trim();
    last = re.lastIndex;
  }
  blocks.push({ heading, body: md.slice(last) });
  for (const b of blocks) {
    const text = b.body
      .replace(/```[\s\S]*?```/g, (s) => s.replace(/```\w*\n?/g, "")) // keep code text, drop fences
      .replace(/[*_`>#|]/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[ \t]+/g, " ")
      .trim();
    if (text.length < 40) continue;
    for (const ch of chunkText(text, b.heading))
      for (const lang of langs)
        add({ lang, kind: "docs", source: `Repo · ${name}`, sourceId: "ingenieria", url: sourceUrl, ...chunkMeta(ch), title: ch.title, text: ch.text, ...extra });
  }
}

// semantic-chunker metadata (parent/ordinal/offsets) — empty under the baseline
const chunkMeta = ({ parent, ordinal, span_start, span_end }) =>
  parent === undefined ? {} : { parent, ordinal, span_start, span_end };

// US I6 chunk metadata shared by every repo-doc chunk: fetched at the pinned
// SHA → attributable to that release; fell back to main → identity stays null.
const repoDocMeta = (pinned) => ({
  source_type: "repo_doc",
  release_id: pinned ? sourcePin.release_id ?? undefined : undefined,
  valid_from: pinned ? (sourcePin.generated_at ?? "").slice(0, 10) || undefined : undefined,
});

// Temporal precedence (US I6): the model card carries the EXECUTED campaign
// results and therefore supersedes the frozen May-2026 proposal's model PLAN —
// the sections that still say "8 modelos" by design (historia no reescrita):
// capiii (producto esperado), capiv (metodología, entrenamiento planteado) and
// tablas (Tabla 3, modelos de referencia). Precedence is RANK-ONLY and applies
// only when chunks of both sides are retrieved for the same query
// (retrieval-core.applyTemporalPrecedence); the historical chunks stay indexed.
const MODEL_CARD_SUPERSEDES = ["capiii", "capiv", "tablas"];

// ── 1. local academic content (ES from source.html, EN from content/en/*) ───
function collectLocal() {
  // section label lookup from site-map (bilingual)
  const sm = readFileSync(join(root, "lib", "site-map.ts"), "utf8");
  const labels = {}; // id → {es,en}
  for (const m of sm.matchAll(/id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*labelEn:\s*"([^"]+)"/g))
    labels[m[1]] = { es: m[2], en: m[3] };
  const lab = (id, lang) => (labels[id]?.[lang]) || id;

  const es = readFileSync(join(root, "content", "source.html"), "utf8");
  const secRe = /<section\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
  let m, nEs = 0;
  while ((m = secRe.exec(es))) {
    const before = chunks.length;
    addSectionHtml(m[1], lab(m[1], "es"), m[2], "es");
    nEs += chunks.length - before;
  }
  let nEn = 0;
  const enDir = join(root, "content", "en");
  // sorted: readdir order is filesystem-dependent — chunk order (and therefore
  // vector order / layer bytes) must be reproducible across machines (US I6).
  for (const file of readdirSync(enDir).sort()) {
    if (!file.endsWith(".html")) continue;
    const id = file.replace(/\.html$/, "");
    const before = chunks.length;
    addSectionHtml(id, lab(id, "en"), readFileSync(join(enDir, file), "utf8"), "en");
    nEn += chunks.length - before;
  }
  console.log(`  local academic: ${nEs} ES + ${nEn} EN chunks`);
}

// ── 2. data-repo docs via GitHub raw (skip-on-fail) ─────────────────────────
const REPO_DOCS = [
  ["docs/data_dictionary.md", "Diccionario de datos"],
  ["schema.sql", "Esquema estrella (DDL)"],
  ["README.md", "README del repositorio"],
  ["docs/example_queries.sql", "Consultas de ejemplo"],
  ["reports/governance/mega_audit_report.md", "Auditoría de calidad"],
  ["docs/ROADMAP.md", "Roadmap"],
  // Audit (post-plan): the seeded suggestion "which model wins?" answered from
  // the frozen May-2026 proposal (8 candidates) because no indexed source
  // carried the current campaign results - the model card is their canonical,
  // auto-regenerated home (MCS, champion, prospective scorecard).
  ["reports/governance/MODEL_CARD.md", "Model card · modelo campeón desplegado, cuál gana y evaluación"],
];
// Fetch one repo doc at the pinned SHA; if the file is missing AT THAT SHA
// (e.g. a release sealed from a dirty worktree), fall back to main and RECORD
// the fallback — never silently mix trust levels.
async function fetchRepoDoc(path) {
  const tryRef = async (ref) => {
    const r = await fetch(`${dataRepoRawAt(ref)}/${path}`);
    if (!r.ok) throw new Error(`${r.status}`);
    return r.text();
  };
  try {
    return { txt: await tryRef(sourcePin.ref), pinned: sourcePin.ref !== "main" };
  } catch (e) {
    if (sourcePin.ref === "main") throw e;
    const txt = await tryRef("main");
    sourcePin.fallbacks.push(path);
    console.warn(`  ! ${path}: missing at pinned ${sourcePin.ref} (${e.message}) — fell back to main (recorded)`);
    return { txt, pinned: false };
  }
}

async function collectRepoDocs() {
  let ok = 0;
  for (const [path, name] of REPO_DOCS) {
    try {
      const { txt, pinned } = await fetchRepoDoc(path);
      const docMeta = repoDocMeta(pinned);
      // Human deep-link stays on blob/main (readable, follows the repo head);
      // the INDEXED BYTES' provenance lives in the chunk meta + meta.json pin.
      const url = `https://github.com/UACJ-MIAAD/VisaPredictAI/blob/main/${path}`;
      if (path.endsWith(".sql")) {
        // SQL: chunk by statement/comment blocks
        const text = txt.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/[ \t]+/g, " ");
        for (const ch of chunkText(text, name))
          add({ lang: "es", kind: "docs", source: `Repo · ${name}`, sourceId: "modelo", url, ...chunkMeta(ch), title: ch.title, text: ch.text, ...docMeta });
      } else if (path.endsWith("MODEL_CARD.md")) {
        // Audit round 2: the card must be retrievable in BOTH language pools
        // (the engine filters chunks by lang) and needs query-shaped keywords —
        // topic words only, NO factual claims (those live in the card itself,
        // regla #0). Without this, "which model wins?" answered from the
        // frozen May proposal.
        // Query-shaped keywords, topic words only — NO factual claims (regla #0;
        // the numbers live in the card itself). Cover natural PARAPHRASES too:
        // BM25 only ranks the verdict chunk when the query shares its terms, so
        // "cuál es el mejor modelo" / "cuántos modelos" used to fall back to the
        // May proposal's "8 candidates" (blind audit round 3).
        const kw =
          "Modelos comparados: cuál gana, cuál es el mejor modelo, cuántos modelos " +
          "compararon, cuántos modelos se evaluaron, ganador, campeón desplegado, " +
          "retador, evaluación prospectiva del pronóstico. Model comparison: which " +
          "model wins, which is the best model, how many models were compared, " +
          "winner, deployed champion, challenger, prospective forecast evaluation.\n\n";
        // temporal: "current" + supersedes → executed results outrank the frozen
        // proposal's model plan whenever both are retrieved (US I6).
        const cardMeta = { ...docMeta, temporal: "current", supersedes: MODEL_CARD_SUPERSEDES };
        addMarkdown(name, kw + txt, url, ["es", "en"], cardMeta);
        // Lexical-only retrieval (pre-consent BM25) needs the VERDICT and the
        // query terms in the SAME chunk: a synthetic chunk pairs the keywords
        // with the card's evaluation section VERBATIM (no hand-typed claims —
        // regla #0: the numbers travel with the auto-regenerated card). A short
        // abbreviation legend prevents the LLM from expanding FAD/DFF wrong
        // (it called DFF "Diversity Visa" and FAD "Family-based" — audit round 3).
        const legend =
          "FAD = Final Action Dates. DFF = Dates for Filing. MCS = Model Confidence Set. ";
        const evalSec = txt.match(/##\s*5\.[^\n]*\n([\s\S]*?)(?=\n##\s|$)/);
        if (evalSec) {
          const evalText = (kw + legend + evalSec[1]).replace(/[*_`>#|]/g, " ").replace(/[ \t]+/g, " ").trim();
          for (const lang of ["es", "en"])
            add({ lang, kind: "docs", source: `Repo · ${name}`, sourceId: "ingenieria", url,
                  title: "Evaluación — qué modelo gana / which model wins", text: evalText, ...cardMeta });
        } else {
          console.warn("  ! MODEL_CARD: sección 5 (Evaluación) no encontrada — chunk sintético omitido");
        }
      } else {
        addMarkdown(name, txt, url, ["es"], docMeta);
      }
      ok++;
    } catch (e) {
      console.warn(`  ! skip ${path}: ${e.message}`);
    }
  }
  console.log(`  repo docs: ${ok}/${REPO_DOCS.length} sources fetched`);
}

// ── 3. live facts from bulletins.json (latest month) ────────────────────────
const MES_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const monthLabel = (m, lang) => {
  const [y, mo] = m.split("-");
  return `${(lang === "en" ? MES_EN : MES_ES)[+mo - 1]} ${y}`;
};
const CN = {
  mexico: { es: "México", en: "Mexico" }, india: { es: "India", en: "India" },
  china: { es: "China", en: "China" }, philippines: { es: "Filipinas", en: "Philippines" },
  all_chargeability: { es: "Resto del mundo", en: "All chargeability areas" },
};
let latestMonth = null;
async function collectFacts() {
  try {
    const r = await fetch(`${REPO_RAW}/data/processed/bulletins.json`);
    if (!r.ok) throw new Error(`${r.status}`);
    const feed = await r.json();
    latestMonth = feed.latest_month;
    for (const lang of ["es", "en"]) {
      const url = localePath("/datos-historicos", lang) + "#boletines";
      const rows = feed.months[feed.latest_month] || [];
      const adv = rows.filter((x) => (x.delta_days ?? 0) > 0);
      const ret = rows.filter((x) => (x.delta_days ?? 0) < 0);
      const lbl = monthLabel(feed.latest_month, lang);
      const cn = (c) => CN[c]?.[lang] || c;
      const fmtList = (xs) =>
        xs.slice(0, 12).map((x) => `${cn(x.country)} ${x.category} ${x.table} (${x.raw_value || "—"})`).join("; ");
      const text =
        lang === "es"
          ? `Boletín más reciente del Visa Bulletin: ${lbl}. Se publicaron ${rows.length} series. Avanzaron ${adv.length} y retrocedieron ${ret.length}. Avances destacados: ${fmtList(adv)}. Retrocesos: ${fmtList(ret)}. Estas son fechas oficiales publicadas, no predicciones del modelo.`
          : `Most recent U.S. Visa Bulletin: ${lbl}. ${rows.length} series published. ${adv.length} advanced and ${ret.length} retrogressed. Notable advances: ${fmtList(adv)}. Retrogressions: ${fmtList(ret)}. These are official published dates, not model predictions.`;
      // source_type "live_fact" + valid_from = the bulletin month (US I6): the
      // ONE feed deliberately read from `main` — it exists to track freshness.
      add({ lang, kind: "fact", source_type: "live_fact", valid_from: feed.latest_month, source: lang === "es" ? "Boletín en vivo" : "Live bulletin", sourceId: "boletines", url, title: `Boletín ${lbl}`, text });
    }
    console.log(`  live facts: latest bulletin ${feed.latest_month}`);
  } catch (e) {
    console.warn(`  ! skip bulletins.json: ${e.message}`);
  }
}

// ── 4. embeddings (Transformers.js, local model, CSP-clean) ─────────────────
async function embedAll() {
  const { pipeline, env } = await import("@huggingface/transformers");
  const modelsDir = join(root, "public", "models");
  mkdirSync(modelsDir, { recursive: true });
  // download into public/models on first build; reuse afterwards. Browser reads
  // the same files (allowRemoteModels=false) → no third-party CDN at runtime.
  env.cacheDir = modelsDir;
  env.allowRemoteModels = true;
  // Always q8 (~118 MB): fp32 is 465 MB — never ship that to a browser. Retry
  // transient network failures rather than degrading to the huge variant.
  let extractor;
  for (let attempt = 1; ; attempt++) {
    try {
      extractor = await pipeline("feature-extraction", EMBED_MODEL, { dtype: "q8" });
      break;
    } catch (e) {
      if (attempt >= 4) throw new Error(`q8 model download failed after ${attempt} tries: ${e.message}`);
      console.warn(`  ! q8 download failed (try ${attempt}): ${e.message} — retrying…`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  const vecs = new Float32Array(chunks.length * EMBED_DIM);
  const BATCH = 32;
  for (let i = 0; i < chunks.length; i += BATCH) {
    // Contextual Retrieval (structural, Época 1.1): prepend the chunk's source/
    // section ONLY to fragmented chunks (academic/docs) so they're situated in
    // their document. Glossary/reference/fact/data are self-contained — prefixing
    // them measurably dilutes retrieval, so they're left as-is.
    const batch = chunks.slice(i, i + BATCH).map((c) => {
      c.embedCtx = (!process.env.VB_NO_CTX && (c.kind === "academic" || c.kind === "docs")) ? c.source : "";
      return `passage: ${c.embedCtx ? c.embedCtx + ". " : ""}${c.text}`;
    });
    const out = await extractor(batch, { pooling: "mean", normalize: true });
    const data = out.data; // Float32Array length batch*dim
    vecs.set(data.subarray ? data.subarray(0, batch.length * EMBED_DIM) : data, i * EMBED_DIM);
    process.stdout.write(`\r  embedding ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
  }
  process.stdout.write("\n");
  // US I6: quantize to f16 and round-trip back to f32 — vectors.f16 (browser)
  // and the base64 f32 monolith (evals) then carry BIT-IDENTICAL values, so
  // production and every gate score the same floats. Little-endian byte order
  // (every supported build/runtime target is LE; decodeF16 reads LE explicitly).
  const f16 = encodeF16(vecs);
  const roundTripped = decodeF16(new Uint8Array(f16.buffer, f16.byteOffset, f16.byteLength));
  return {
    vectorsB64: Buffer.from(roundTripped.buffer).toString("base64"),
    f16Bytes: Buffer.from(f16.buffer, f16.byteOffset, f16.byteLength),
  };
}

// ── model pin verification (US I6) ──────────────────────────────────────────
// Runs AFTER the pipeline (files exist whether they came from cache or a fresh
// download). sha256 drift = supply-chain alarm → fail the build.
function verifyModelPin() {
  const base = join(root, "public", "models", MODEL_PIN.name);
  const bad = [];
  const verified = {};
  for (const [rel, expected] of Object.entries(MODEL_PIN.files)) {
    const p = join(base, rel);
    if (!existsSync(p)) { bad.push(`${rel}: missing`); continue; }
    const got = createHash("sha256").update(readFileSync(p)).digest("hex");
    verified[rel] = got;
    if (got !== expected) bad.push(`${rel}: sha256 ${got.slice(0, 12)}… != pinned ${expected.slice(0, 12)}…`);
  }
  if (bad.length)
    throw new Error(`MODEL PIN VIOLATION (${MODEL_PIN.name} @ ${MODEL_PIN.revision}):\n  ${bad.join("\n  ")}\n  If the upgrade is intentional, update MODEL_PIN in scripts/build-rag-index.mjs.`);
  console.log(`  model pin: ${Object.keys(verified).length} files sha256-verified (${MODEL_PIN.name} @ ${MODEL_PIN.revision.slice(0, 12)})`);
  return verified;
}

// ── 5. data-derived starter prompts (not hand-written facts) ────────────────
function buildSuggestions() {
  const wanted = ["final action", "dates for filing", "retrogres", "chargeab", "cargab", "mase", "crisp"];
  const glOf = (lang) => {
    const terms = chunks.filter((c) => c.kind === "glossary" && c.lang === lang);
    const out = [];
    for (const w of wanted) {
      const t = terms.find((x) => x.title.toLowerCase().includes(w) || x.text.toLowerCase().includes(w));
      if (t && !out.includes(t.title)) out.push(t.title);
      if (out.length >= 3) break;
    }
    return out;
  };
  const gl = glOf("es");
  const glEn = glOf("en");
  const monthEs = latestMonth ? monthLabel(latestMonth, "es") : null;
  const monthEn = latestMonth ? monthLabel(latestMonth, "en") : null;
  const es = [
    "Muéstrame el pronóstico de México F2A",
    monthEs ? `¿Qué cambió en el boletín de ${monthEs}?` : "¿Cómo funciona el Visa Bulletin?",
    ...gl.map((t) => `¿Qué es ${t}?`),
    "¿Qué modelos compara el proyecto y cuál gana?",
    "¿Cómo está estructurado el panel multiserie y_{p,c,b,t}?",
  ].slice(0, 6);
  const en = [
    "Show the forecast for Mexico F2A",
    monthEn ? `What changed in the ${monthEn} bulletin?` : "How does the Visa Bulletin work?",
    ...glEn.map((t) => `What is ${t}?`),
    "Which models does the project compare and which one wins?",
    "How is the multi-series panel y_{p,c,b,t} structured?",
  ].slice(0, 6);
  return { es, en };
}

// Categorized, curated prompt library — a help/onboarding surface. Prompts are
// derived from the glossary + latest bulletin so they stay fresh; chart prompts
// trigger the data visualizations.
function buildPrompts() {
  const glTerms = (lang, wanted, n) => {
    const terms = chunks.filter((c) => c.kind === "glossary" && c.lang === lang);
    const out = [];
    for (const w of wanted) {
      const t = terms.find((x) => x.title.toLowerCase().includes(w) || x.text.toLowerCase().includes(w));
      if (t && !out.includes(t.title)) out.push(t.title);
      if (out.length >= n) break;
    }
    return out;
  };
  const glWanted = ["final action", "dates for filing", "retrogres", "per-country", "chargeab", "cargab", "priority", "prioridad", "mase", "smape", "crisp", "conform", "walk", "arima", "sarima", "deepar", "prophet", "theta", "ets", "msis", "crps", "ensemble", "ina"];
  const mk = (lang) => {
    const en = lang === "en";
    const gl = glTerms(lang, glWanted, 12);
    const m = latestMonth ? monthLabel(latestMonth, lang) : null;
    // ≈ one year before the latest bulletin, derived (never hard-typed) so the
    // "compare two bulletins" prompts stay fresh — regla #0.
    const yearAgo = latestMonth ? (() => { const [y, mo] = latestMonth.split("-"); return `${+y - 1}-${mo}`; })() : null;
    const mAgo = yearAgo ? monthLabel(yearAgo, lang) : null;
    return [
      { icon: "glossary", cat: en ? "Glossary" : "Glosario",
        items: gl.map((t) => (en ? `What is ${t}?` : `¿Qué es ${t}?`)) },
      { icon: "data", cat: en ? "Data & bulletin" : "Datos y boletín",
        items: en
          ? [m ? `What changed in the ${m} bulletin?` : "How does the Visa Bulletin work?", "How is the multi-series panel y_{p,c,b,t} structured?", "What do the statuses C, F and U mean?", "What is the base date for the data?", "Which countries and categories are covered?", "How many observations does the panel have?", "Why is Mexico the pilot country?", "What's the difference between FAD and DFF?", "How far back does the data go?", "What is a chargeability area?", "How is the data scraped and updated?", "What share of the panel is predictable (F)?"]
          : [m ? `¿Qué cambió en el boletín de ${m}?` : "¿Cómo funciona el Visa Bulletin?", "¿Cómo está estructurado el panel multiserie y_{p,c,b,t}?", "¿Qué significan los estados C, F y U?", "¿Cuál es la fecha base de los datos?", "¿Qué países y categorías cubre?", "¿Cuántas observaciones tiene el panel?", "¿Por qué México es el país piloto?", "¿Cuál es la diferencia entre FAD y DFF?", "¿Hasta qué año llegan los datos?", "¿Qué es un área de cargabilidad?", "¿Cómo se extraen y actualizan los datos?", "¿Qué porcentaje del panel es predecible (F)?"] },
      { icon: "models", cat: en ? "Models & methodology" : "Modelos y metodología",
        items: en
          ? ["Which models does the project compare and which one wins?", "Do neural networks beat the simple models?", "What methodology does the project follow?", "What error metrics does it use?", "How is the forecast validated without leakage?", "What is walk-forward validation?", "How are the 95% prediction intervals built?", "Which model produces the production DFF forecast?", "What is conformal prediction?", "How many models are in the comparison pool?", "What is the CRISP-DM methodology?", "How are models compared statistically?"]
          : ["¿Qué modelos compara el proyecto y cuál gana?", "¿Las redes neuronales superan a los modelos simples?", "¿Qué metodología sigue el proyecto?", "¿Qué métricas de error usa?", "¿Cómo se valida el pronóstico sin fuga de datos?", "¿Qué es la validación walk-forward?", "¿Cómo se construyen los intervalos de predicción al 95 %?", "¿Qué modelo genera el pronóstico de producción en DFF?", "¿Qué es la predicción conforme?", "¿Cuántos modelos hay en el pool de comparación?", "¿Qué es la metodología CRISP-DM?", "¿Cómo se comparan los modelos estadísticamente?"] },
      { icon: "models", cat: en ? "Forecasts (zoom)" : "Pronósticos (zoom)",
        items: en
          ? ["Show the forecast for Mexico F2A", "Forecast for India EB2", "Predict Philippines F4 (DFF)", "Projection for China EB3", "Zoom into Mexico F3 forecast", "Forecast India F1 (FAD)", "Forecast All Chargeability F4", "Predict Mexico EB3 (DFF)", "Forecast China F4", "Zoom Philippines F1", "Forecast India F2B", "Projection for Mexico F1 (DFF)"]
          : ["Muéstrame el pronóstico de México F2A", "Pronóstico de India EB2", "Predice Filipinas F4 (DFF)", "Proyección de China EB3", "Zoom al pronóstico de México F3", "Pronóstico India F1 (FAD)", "Pronóstico de All Chargeability F4", "Predice México EB3 (DFF)", "Pronóstico de China F4", "Zoom Filipinas F1", "Pronóstico India F2B", "Proyección de México F1 (DFF)"] },
      { icon: "charts", cat: en ? "Charts (data viz)" : "Gráficos (visualizaciones)",
        items: en
          ? [m ? `Show the ${m} bulletin table` : "Show the latest bulletin table", (m && mAgo) ? `Compare the ${mAgo} and ${m} bulletins` : "Compare two bulletins", (m && mAgo) ? `What changed between ${mAgo} and ${m}?` : "What changed between two bulletins?", "Show Mexico F3's date evolution", "Compare the wait across countries for F4", "Heatmap of family categories", "Wait radar by country", "Country race for F3", "India EB2 monthly movement", "Mexico F4 backlog vs the world", "Status mix (C/F/U) for India F1", "Employment heatmap (DFF)", "China F4 priority-date evolution", "Compare the wait for F2A across countries", "Monthly movement of Philippines F4", "Country race for F4 (DFF)"]
          : [m ? `Muéstrame la tabla del boletín de ${m}` : "Muéstrame la tabla del último boletín", (m && mAgo) ? `Compara los boletines de ${mAgo} y ${m}` : "Compara dos boletines", (m && mAgo) ? `¿Qué cambió entre ${mAgo} y ${m}?` : "¿Qué cambió entre dos boletines?", "Muéstrame la evolución de México F3", "Compara la espera entre países en F4", "Mapa de calor de las categorías familiares", "Radar de espera por país", "Carrera de países en F3", "Movimiento mensual de India EB2", "Backlog de México F4 vs el mundo", "Mezcla de estado (C/F/U) de India F1", "Mapa de calor de empleo (DFF)", "Evolución de la fecha de China F4", "Compara la espera de F2A entre países", "Movimiento mensual de Filipinas F4", "Carrera de países en F4 (DFF)"] },
      { icon: "refs", cat: en ? "References" : "Referencias",
        items: en
          ? ["Which reference backs CRISP-DM?", "What reference introduces the MASE metric?", "What reference is Prophet based on?", "Which paper proposes DeepAR?", "What reference covers conformal prediction?", "Which reference is behind walk-forward validation?"]
          : ["¿Qué referencia respalda CRISP-DM?", "¿Qué referencia introduce la métrica MASE?", "¿En qué referencia se basa Prophet?", "¿Qué artículo propone DeepAR?", "¿Qué referencia cubre la predicción conforme?", "¿Qué referencia respalda la validación walk-forward?"] },
    ];
  };
  return { es: mk("es"), en: mk("en") };
}

// ── self-host the ONNX-runtime wasm (CSP-clean; Transformers.js defaults to a
//    CDN). Copy ONLY the asyncify build: transformers.js imports
//    `onnxruntime-web/webgpu`, whose loader requests
//    ort-wasm-simd-threaded.asyncify.{mjs,wasm} from env.wasm.wasmPaths
//    ("/ort/", see components/visabot/engine.ts). The jsep build was ~26 MB of
//    dead weight the runtime never fetched (AZ2). Stale files are pruned so
//    the Netlify build cache (netlify-plugin-cache persists public/ort) can't
//    resurrect them. ──────────────────────────────────────────────────────────
function copyOrtWasm() {
  const src = join(root, "node_modules", "onnxruntime-web", "dist");
  const dst = join(root, "public", "ort");
  const KEEP = /^ort-wasm-simd-threaded\.asyncify\.(wasm|mjs)$/;
  mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of readdirSync(src)) {
    if (KEEP.test(f)) {
      copyFileSync(join(src, f), join(dst, f));
      n++;
    }
  }
  for (const f of readdirSync(dst)) {
    if (!KEEP.test(f)) {
      unlinkSync(join(dst, f));
      console.log(`  ort wasm: pruned stale ${f}`);
    }
  }
  console.log(`  ort wasm: ${n} files → public/ort/`);
}

// ── main ────────────────────────────────────────────────────────────────────
(async () => {
  console.log("VisaBot · building RAG knowledge index…");
  copyOrtWasm();
  await resolveSourcePin();
  collectLocal();
  await collectRepoDocs();
  await collectFacts();
  console.log(`  total chunks: ${chunks.length}`);
  if (chunks.length === 0) throw new Error("no chunks collected — aborting");

  const { vectorsB64, f16Bytes } = await embedAll();
  const modelFilesVerified = verifyModelPin();
  const suggestions = buildSuggestions();

  const outDir = join(root, "public", "rag");
  mkdirSync(outDir, { recursive: true });
  // ONE serialization of the chunk list feeds both layers — chunks.json (client,
  // pre-consent BM25) and index.json (eval monolith) can never drift.
  const serialChunks = chunks.map(
    ({ id, lang, source, sourceId, url, title, text, kind, embedCtx, source_type, release_id, valid_from, temporal, supersedes, parent, ordinal, span_start, span_end }) =>
      ({ id, lang, source, sourceId, url, title, text, kind, embedCtx, source_type, release_id, valid_from, temporal, supersedes, parent, ordinal, span_start, span_end }),
  );
  // Layer 1 (pre-consent): chunks only, NO timestamp → byte-reproducible.
  const chunksBuf = Buffer.from(
    JSON.stringify({
      schema: 1,
      model: EMBED_MODEL,
      dim: EMBED_DIM,
      vectors: { file: "vectors.f16", dtype: "f16", count: chunks.length },
      chunks: serialChunks,
    }),
  );
  writeFileSync(join(outDir, "chunks.json"), chunksBuf);
  // Layer 2 (post-consent): raw f16 vectors, byte-reproducible.
  writeFileSync(join(outDir, "vectors.f16"), f16Bytes);
  // Eval monolith (rag-golden-eval / rag-selfcheck / rag-eval / rag-injection-eval
  // + the deployed copies they probe over HTTP). Not fetched by the browser.
  writeFileSync(
    join(outDir, "index.json"),
    JSON.stringify({
      model: EMBED_MODEL,
      dim: EMBED_DIM,
      built: new Date().toISOString(),
      chunks: serialChunks,
      vectors: vectorsB64,
    }),
  );
  writeFileSync(join(outDir, "suggestions.json"), JSON.stringify(suggestions, null, 0));
  writeFileSync(join(outDir, "prompts.json"), JSON.stringify(buildPrompts(), null, 0));

  // F4: corpus STALE jamás se indexa — la añada del feed debe existir; un índice
  // construido sin boletín vivo serviría respuestas de un corte fantasma.
  if (!latestMonth) throw new Error("F4: corpus sin latest_month (bulletins.json no cargó) — índice stale, se aborta");

  // Build manifest — `built` is the ONLY field read programmatically (the
  // deploy-freshness smoke waits for it to advance); the rest is an inspectable
  // heartbeat (curl /rag/meta.json). NOT for the console — that reads
  // suggestions.json / prompts.json (audit r4: dropped the dead byKind loop and
  // the misleading "for the assistant console" claim).
  // F4 (plan auditoría 2026-07-11): campos de GOBERNANZA aditivos — el manifiesto
  // declara chunking, cuantización, la huella completa de recuperación (importada de
  // retrieval-core: única fuente) y las versiones por hash de los sets de evaluación,
  // para que cada índice publicado sea auditable de punta a punta.
  const setVersion = (f) => createHash("sha256").update(readFileSync(join(root, "scripts", f))).digest("hex").slice(0, 12);
  const { BM25_K1, BM25_B, RRF_K, POOL, MMR_LAMBDA } = await import("../lib/visabot/retrieval-core.mjs");
  const layerHash = (buf) => ({ sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length });
  writeFileSync(
    join(outDir, "meta.json"),
    JSON.stringify({
      built: new Date().toISOString(),
      model: EMBED_MODEL,
      dim: EMBED_DIM,
      chunks: chunks.length,
      sources: new Set(chunks.map((c) => c.source)).size,
      langs: [...new Set(chunks.map((c) => c.lang))],
      latestMonth,
      // US I6 — pins: WHICH repo state the docs were read at and WHICH exact
      // model embedded them. `layers` carries content hashes of the timestamp-
      // free artifacts: two builds of the same sources must produce the same
      // sha256 here (reproducibility gate; `built` above is the only exempt field).
      pins: {
        source: sourcePin,
        model: { name: MODEL_PIN.name, revision: MODEL_PIN.revision, files: modelFilesVerified, verified: true },
      },
      layers: {
        "chunks.json": layerHash(chunksBuf),
        "vectors.f16": layerHash(f16Bytes),
      },
      governance: {
        quantization: "q8",
        vector_dtype: "f16-roundtrip", // f32 embeddings quantized to f16, round-tripped: evals and browser score identical floats
        chunking: { chars: CHUNK_CHARS, overlap: CHUNK_OVERLAP },
        retrieval: { bm25_k1: BM25_K1, bm25_b: BM25_B, rrf_k: RRF_K, pool: POOL, mmr_lambda: MMR_LAMBDA },
        temporal_precedence: { model_card_supersedes: MODEL_CARD_SUPERSEDES },
        eval_sets: {
          retrieval: setVersion("rag-eval-set.json"),
          injection: setVersion("rag-injection-set.json"),
        },
        generation: "netlify/functions/chat.mjs (proveedor+prompt+allowlist+fallback extractivo; timeout y stream-guards ahí)",
      },
    }),
  );
  // F3 + auditoría 12-jul-2026: mapa hash → metadata CANÓNICA para
  // netlify/functions/chat.mjs. El server solo acepta como FUENTES texto publicado en
  // este índice (o los 2 sintéticos del console) Y ADEMÁS reescribe title/source desde
  // ESTE mapa, ignorando los que manda el cliente — así un chunk auténtico no puede
  // citarse con una fuente inventada ("Comunicado oficial…"). El texto del chunk es la
  // clave; su title/source vienen del índice, no del payload.
  const fnDir = join(root, "netlify", "functions");
  mkdirSync(fnDir, { recursive: true });
  const hashMeta = {};
  for (const c of chunks) {
    const h = createHash("sha256").update(c.text, "utf8").digest("hex");
    hashMeta[h] = { title: c.title || "", source: c.source || "", sourceId: c.sourceId || "" };
  }
  writeFileSync(join(fnDir, "rag-hashes.json"), JSON.stringify(hashMeta));
  console.log(`✓ wrote netlify/functions/rag-hashes.json (${chunks.length} hash→meta entries)`);
  console.log(`✓ wrote public/rag/index.json (${chunks.length} chunks, ${EMBED_DIM}-d) — eval monolith`);
  console.log(`✓ wrote public/rag/chunks.json (${(chunksBuf.length / 1024).toFixed(0)} kB, pre-consent) + vectors.f16 (${(f16Bytes.length / 1024).toFixed(0)} kB, post-consent)`);
  console.log(`✓ wrote public/rag/suggestions.json + meta.json`);
  if (!existsSync(join(root, "public", "models", EMBED_MODEL)))
    console.warn("  ! model dir not found under public/models — runtime will need it");
})().catch((e) => {
  console.error("✗ build-rag-index failed:", e);
  process.exit(1);
});
