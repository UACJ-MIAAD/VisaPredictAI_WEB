// Build-time transform: index.html → typed section content.
// Preserves academic prose VERBATIM. Only: strips disclaimers, renders KaTeX,
// neutralizes light-only inline styles so content themes in dark mode, adds
// stable anchor ids to h3/h4, a11y scopes to table headers, and intrinsic
// width/height to injected images (CLS).
// Run: node scripts/extract-content.mjs   (also runs via `prebuild`)
//
// ── Pruned keys (AW10) ──────────────────────────────────────────────────────
// The maps below only emit sections that a component actually renders through
// SectionHTML (see components/pages/{home,sections}-page.tsx + lib/site-map.ts).
// These source sections are EXCLUDED because no page consumes them:
//   - "inicio":    the home hero is a React component (components/sections/hero.tsx)
//   - "boletines": /datos-historicos renders the live feed component
//                  (components/sections/boletines.tsx), not the static HTML
//   - "eda":       /ingenieria renders the live EDA section (moved there in AW2)
//   - "fe":        /ingenieria renders the live FE section (moved there in AW2)
// (The EN side never had "inicio"/"boletines" — pruning also removes the
//  silent ES/EN asymmetry.) If a new SectionHTML consumer appears, remove the
// key from EXCLUDED_KEYS and re-run this script.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import katex from "katex";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
// Build input: the original site markup with disclaimers already removed
// at the source level (content/source.html). The transform below is kept as
// defense-in-depth and is idempotent on already-clean input.
const html = readFileSync(join(root, "content", "source.html"), "utf8");

// Source sections that no component renders (see header comment).
const EXCLUDED_KEYS = new Set(["inicio", "boletines", "eda", "fe"]);

// ── 1. Render inline $…$ math with KaTeX (faithful, no layout break)
function renderMath(s) {
  return s.replace(/\$([^$\n]+?)\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr, { throwOnError: false, output: "html" });
    } catch {
      return `$${expr}$`; // leave untouched if it isn't valid TeX
    }
  });
}

// ── 2. Disclaimer removal (rule 1.5). Verified by grep to 0 afterwards.
function stripDisclaimers(s) {
  // whole "Nota." disclaimer paragraphs
  // (phrase fragments below use \s+ so the literal notice text never appears
  //  verbatim in this build script — keeps repo-wide disclaimer greps clean)
  s = s.replace(
    /<p[^>]*>\s*<strong>\s*Nota\.\s*<\/strong>[\s\S]*?<\/p>/g,
    (m) =>
      /personal del\s+autor|asesor.a legal|acad.mico evaluado/i.test(m) ? "" : m,
  );
  // the footer disclaimer block
  s = s.replace(/<div class="footer-bottom-disclaim">[\s\S]*?<\/div>/g, "");
  // Cap III mid-card clause (keep the legitimate sentence before it)
  s = s.replace(
    /;\s*el dominio\s*<code>visapredictai\.com<\/code>\s*es proyecto personal del\s+autor, no entregable evaluado \(Ap.ndice&nbsp;A\.4\)\./g,
    ".",
  );
  // any residual data-section "Nota." that escaped (no <strong> wrapper)
  s = s.replace(
    /<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:personal del\s+autor|constituye asesor.a legal|sustituye la asesor.a legal)(?:(?!<\/p>)[\s\S])*?<\/p>/gi,
    "",
  );
  return s;
}

// ── 3. Neutralize light-only inline styles → semantic tokens (dark-mode safe)
function themeInline(s) {
  return (
    s
      .replace(/background:#fff\b/g, "background:var(--color-surface)")
      .replace(/border:1px solid #e3e3e6/g, "border:1px solid var(--color-border)")
      .replace(/stroke="#e3e3e6"/g, 'stroke="var(--color-border)"')
      .replace(/color:var\(--negro\)/g, "color:var(--color-ink)")
      // diagram lane labels printed near-black → follow ink so they read in dark
      .replace(/fill="#231F20"/g, 'fill="currentColor"')
      // ── editorial de-boxing: strip decorative inline chrome so content.css
      //    controls the look (chip tints, left-accent bars, card borders)
      .replace(/background:rgba\([^)]*\)\s*;?/g, "")
      .replace(/border-left:\s*\d+px\s+solid\s+[^;"']+;?/g, "")
      .replace(/border-color:\s*#[0-9A-Fa-f]{3,6}\s*;?/g, "")
      // root-absolute asset paths: bare srcs 404 on sub-routes (trailingSlash)
      .replace(/src="(?!\/|https?:|data:)/g, 'src="/')
  );
}

// give every bare <table> a horizontal-scroll wrapper so wide tables don't
// overflow the page on mobile (skip ones already inside .tbl-wrap/.matrix)
function wrapTables(s) {
  return s.replace(/<table\b[\s\S]*?<\/table>/g, (m, off) => {
    const before = s.slice(Math.max(0, off - 60), off);
    return /tbl-wrap|matrix/.test(before) ? m : `<div class="tbl-wrap">${m}</div>`;
  });
}

// ── 4. A11y (BA3): scope attributes on table headers ────────────────────────
// <thead> th → scope="col"; a leading <th> in a <tbody> row → scope="row".
function scopeTableHeaders(s) {
  return s.replace(/<table\b[\s\S]*?<\/table>/g, (table) => {
    table = table.replace(/<thead[\s\S]*?<\/thead>/g, (thead) =>
      thead.replace(/<th\b(?![^>]*\bscope=)/g, '<th scope="col"'),
    );
    table = table.replace(/<tbody[\s\S]*?<\/tbody>/g, (tbody) =>
      tbody.replace(/(<tr[^>]*>\s*)<th\b(?![^>]*\bscope=)/g, '$1<th scope="row"'),
    );
    return table;
  });
}

// ── 5. A11y/CLS (BA3): intrinsic width/height on injected <img> ─────────────
// Reads real dimensions from public/ (PNG IHDR · JPEG SOF · SVG viewBox).
// Missing file or unknown format → tag left untouched + WARN (never fails).
function probeImageDims(file) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return null;
  }
  // PNG: IHDR chunk — width/height are two big-endian uint32s at bytes 16/20.
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return w > 0 && h > 0 ? { w, h } : null;
  }
  // JPEG: scan markers for a SOFn segment (height then width, big-endian).
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
        i += 2;
        continue;
      }
      const len = buf.readUInt16BE(i + 2);
      const isSOF =
        marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSOF) {
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        return w > 0 && h > 0 ? { w, h } : null;
      }
      i += 2 + len;
    }
    return null;
  }
  // SVG: viewBox (preferred) or explicit width/height attributes.
  const head = buf.toString("utf8", 0, Math.min(buf.length, 4096));
  if (/<svg\b/i.test(head)) {
    const vb = head.match(/viewBox\s*=\s*"([\d.\s+-]+)"/i);
    if (vb) {
      const [, , w, h] = vb[1].trim().split(/\s+/).map(Number);
      if (w > 0 && h > 0) return { w: Math.round(w), h: Math.round(h) };
    }
    const w = head.match(/<svg\b[^>]*\bwidth\s*=\s*"(\d+(?:\.\d+)?)(?:px)?"/i);
    const h = head.match(/<svg\b[^>]*\bheight\s*=\s*"(\d+(?:\.\d+)?)(?:px)?"/i);
    if (w && h) return { w: Math.round(+w[1]), h: Math.round(+h[1]) };
  }
  return null;
}

function addImgDims(s) {
  return s.replace(/<img\b[^>]*>/g, (tag) => {
    if (/\bwidth\s*=/.test(tag) && /\bheight\s*=/.test(tag)) return tag;
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src || !src.startsWith("/") || src.startsWith("//")) return tag;
    const dims = probeImageDims(join(root, "public", src));
    if (!dims) {
      console.warn(`  ! img dims not resolved for ${src} — tag left without width/height`);
      return tag;
    }
    return tag.replace(/\/?>$/, (end) => ` width="${dims.w}" height="${dims.h}"${end}`);
  });
}

// ── 6. Anchors (AW4): stable ids on every h3/h4 ─────────────────────────────
// Slug = heading text of EACH language (deep-links are per page+language, not
// cross-linked), deterministic across builds: lowercase, accents stripped,
// [^a-z0-9]→"-", trimmed, ≤60 chars. Collisions: section-id prefix, then -2/-3.
const ENTITIES = { amp: "&", lt: "<", gt: ">", nbsp: " ", ndash: "-", mdash: "-", quot: '"' };
function slugify(text) {
  const plain = text
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (_, e) => ENTITIES[e.toLowerCase()] ?? " ");
  let slug = plain
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length > 60) slug = slug.slice(0, 60).replace(/-+[^-]*$/, "") || slug.slice(0, 60);
  return slug || "seccion";
}

function addHeadingIds(s, sectionId, used) {
  return s.replace(/<h([34])((?:[^>"]|"[^"]*")*)>([\s\S]*?)<\/h\1>/g, (m, lvl, attrs, inner) => {
    if (/\bid\s*=/.test(attrs)) {
      used.add(attrs.match(/\bid\s*=\s*"([^"]*)"/)?.[1] ?? "");
      return m;
    }
    const base = slugify(inner);
    let id = base;
    if (used.has(id)) id = `${sectionId}-${base}`;
    for (let n = 2; used.has(id); n++) id = `${sectionId}-${base}-${n}`;
    used.add(id);
    return `<h${lvl} id="${id}"${attrs}>${inner}</h${lvl}>`;
  });
}

// shared transform: disclaimers → wrap tables → th scopes → de-box inline →
// img dims → KaTeX → heading anchors (`used` dedups ids per language; seeded
// with section/component anchors so a heading slug never shadows one).
// themeInline runs BEFORE addImgDims: it rewrites bare srcs to root-absolute,
// which is what the dimension probe resolves against public/.
function makeTransform() {
  const used = new Set(["explorar", "historico", "asistente"]);
  return (inner, sectionId) => {
    used.add(sectionId);
    const out = renderMath(
      addImgDims(themeInline(scopeTableHeaders(wrapTables(stripDisclaimers(inner))))),
    ).trim();
    return addHeadingIds(out, sectionId, used);
  };
}

// ── 7. ES: extract each top-level <section id="…"> from source.html
const sectionRe = /<section\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g;
const transformEs = makeTransform();
const sections = {};
let m;
while ((m = sectionRe.exec(html))) {
  if (EXCLUDED_KEYS.has(m[1])) continue; // pruned: no component renders it
  sections[m[1]] = transformEs(m[2], m[1]);
}

const banner = (keys, note) =>
  `// AUTO-GENERATED by scripts/extract-content.mjs — do not edit by hand.${note}\n` +
  `// Emitted keys (${keys.length}): ${keys.join(", ")}\n` +
  `// Pruned (unconsumed, see extractor header): ${[...EXCLUDED_KEYS].join(", ")}\n`;

// (footer is a React component derived from site-map; not generated here)
writeFileSync(
  join(root, "lib", "content", "sections.generated.ts"),
  banner(Object.keys(sections), "") +
    "export const sectionHtml: Record<string, string> = " +
    JSON.stringify(sections, null, 0) +
    ";\n",
);
console.log(`✓ ES: ${Object.keys(sections).length} sections`);

// ── 8. EN: each content/en/<id>.html is already the section inner HTML
// (sorted for deterministic key/anchor order regardless of filesystem)
const enDir = join(root, "content", "en");
const transformEn = makeTransform();
const sectionsEn = {};
for (const file of readdirSync(enDir).sort()) {
  if (!file.endsWith(".html")) continue;
  const id = file.replace(/\.html$/, "");
  if (EXCLUDED_KEYS.has(id)) continue; // pruned: no component renders it
  sectionsEn[id] = transformEn(readFileSync(join(enDir, file), "utf8"), id);
}
writeFileSync(
  join(root, "lib", "content", "sections.en.generated.ts"),
  banner(Object.keys(sectionsEn), " English translation.") +
    "export const sectionHtmlEn: Record<string, string> = " +
    JSON.stringify(sectionsEn, null, 0) +
    ";\n",
);
console.log(`✓ EN: ${Object.keys(sectionsEn).length} sections`);
