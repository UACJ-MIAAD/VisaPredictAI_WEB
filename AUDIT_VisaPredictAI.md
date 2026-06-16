# AUDIT — VisaPredictAI (pre-rebuild)

> Read-only audit. **No source files were modified.** Generated 2026-06-16.

## 1. Current tech stack

| Item | Reality |
|---|---|
| Framework | **None.** Static single-page site. |
| Files | One `index.html` (3,146 lines, 222 KB) with **all CSS and JS inline**. |
| Build step | None. No `package.json`, no `node_modules`, no bundler. |
| Deploy | Netlify auto-deploy from `main` (`UACJ-MIAAD/VisaPredictAI_WEB`); Firebase Hosting alt (`.firebaserc`). |
| Fonts | Google Fonts CDN: Playfair Display, DM Sans, Space Mono. |
| Runtime libs | **Zero.** No KaTeX, no MathJax, no Chart.js, no jQuery. All JS is one inline IIFE. |
| Theme | **Light only.** No dark mode, no theme toggle, no `next-themes`. |

## 2. Directory structure

```
VisaPredictAI_web/
├── index.html              ★ entire site (3,146 lines)
├── index4.html             legacy design (pre-v3)
├── index_legacy.html.bak   older backup
├── CLAUDE.md, README.md
├── .firebaserc, .gitignore
├── LogoVisaPredictAI.png · LogoVisaPredictAI_vfull.png   logos
├── JARSPROFILE.jpg · JaviRebull.png                       author photos
├── DrVicente.png                                          advisor photo
├── logouacj.png                                           UACJ logo
└── schema_er.svg                                          star-schema ER diagram (11.6 KB)
```

## 3. Pages / components

Single page. **17 anchored sections** (no componentization — flat HTML):
`#inicio #resumen #capi #capii #capiii #capiv #datos #boletines #mlops #estructura #modelo #tablas #reproducibilidad #glosario #referencias #autores #contacto`

Plus a sticky `#nav` with `#navLinks` / `#navToggle` (mobile hamburger).

## 4. Sections found (all present)

Inicio · Resumen · Cap I–IV · Base de datos (`#datos`) · Boletines (live feed) · MLOps · Estructura del repo · Modelo de datos / star schema (`#modelo`) · Tablas · Reproducibilidad · Glosario · Referencias · Autores · Contacto. **All 17 confirmed.**

## 5. Tables

6 `<table>` blocks: Tabla 1 (cobertura), Tabla 2 (exclusión), Tabla 3 (8 modelos comparados), star-schema catalog, plus the **live Boletines table** (`#blnBody`, JS-rendered). All static HTML except Boletines.

## 6. Figures / diagrams

**10 inline `<svg>` diagrams** hand-authored (pipeline 6-etapas, EB-5 timeline, status F/C/U distribution, CI double-pipeline, methodology arrows, gradients `ciGrad`/`bdBlue`/`mlBlue` etc.) + 1 external `schema_er.svg`. **None are dark-mode aware** (fills hardcoded to UACJ hex).

## 7. Assets & render status

| Asset | Referenced in `<img>`? | Renders |
|---|---|---|
| `LogoVisaPredictAI.png` | yes (favicon + header) | ✅ |
| `schema_er.svg` | yes (`#modelo`) | ✅ light only — hardcoded fills, will glare in dark |
| `JARSPROFILE.jpg` | yes (`#autores`) | ✅ |
| `DrVicente.png` | yes (`#autores`) | ✅ |
| `LogoVisaPredictAI_vfull.png`, `JaviRebull.png`, `logouacj.png` | **not referenced** | unused assets |

## 8. Live "Boletines" feed logic

Inline IIFE (lines 3081–3142). Lazy-loads on scroll via `IntersectionObserver` (200px margin), then:
```
FEED = https://raw.githubusercontent.com/UACJ-MIAAD/VisaPredictAI/main/data/processed/bulletins.json
```
Shape: `{ generated_utc, latest_month, available_months[24], months{ "YYYY-MM": [rows] } }`.
Row: `{country, block, category, table, status, raw_value, delta_days}`.
Renders a "Nuevo boletín" card + a month-selectable, text-filterable table. Has a **catch → error message**, but **no loading skeleton and no empty state**. ✅ Feed reachable (HTTP 200, 608 KB). **Preserve this logic verbatim.**

## 9. Data source for Visa Bulletin data (for new historical section)

**Real, confirmed, reachable** — the same repo's processed panel:

| File | Local | Remote (raw.githubusercontent) | Size / rows |
|---|---|---|---|
| `visa_panel_long.csv` | ✅ | ✅ HTTP 200 | 1.5 MB · **27,277 rows** |
| `visa_panel_long.parquet` | ✅ | (regenerable) | 95 KB |
| `bulletins.json` (feed) | ✅ | ✅ HTTP 200 | 608 KB · 24 months |
| `visapredict.duckdb` | ✅ (gitignored) | ✗ | 11 MB |

**CSV schema (maps 1:1 to the requested `VisaPanelRow`):**
`country, block, category, table, bulletin_date, status, priority_date, days_since_base, raw_value`

**Computed stats (use THESE, not the prompt's stale "expected" numbers):**
- Total: **27,277 rows** (prompt said 27,127 — data grew with Jul-2026 bulletin).
- Status: **F 15,755 (57.8%) · C 10,951 (40.1%) · U 570 (2.1%) · UNK 1**.
- Countries: `mexico, india, china, philippines, all_chargeability` (+ `row`, DV in raw).
- Tables: FAD, DFF. Blocks: family, employment.
- Span: dic-2001 → jul-2026 (DFF from nov-2015).

→ **No fabrication needed. Real source exists for every required chart and the 27k-row table.**

## 10. Math rendering

**Broken today.** 30 literal `$...$` LaTeX spans in body text (`$y_{p,c,b,t}$`, `$e=F$`, `$\phi_p$`…) render as **raw dollar signs** — no KaTeX/MathJax is loaded. Only the hero uses `<sub>` HTML (`y<sub>p,c,b,t</sub>`). KaTeX is a genuine fix, not just polish.

## 11. Disclaimer fragments to remove (rule 1.5)

| Fragment | Hits |
|---|---|
| Pattern P1 — "proyecto personal…autor" | 4 |
| Pattern P2 — "entregable…evaluado" | 2 |
| Pattern P3 — "Aviso…académico" | 1 |
| Pattern P4 — "Apéndice…A.2" | 1 |
| Pattern P5 — "no constituye…legal" | 1 |

Present as a top banner + footer + inline "Nota." notes. Target: **0** after rebuild.
**Conflict flagged:** the web `CLAUDE.md` §g Don't #1 mandates this banner. The rebuild prompt orders its removal. Prompt wins for this task; noting the contradiction.

## 12. Content inventory to preserve (rule 1.3)

- **64** IEEE references (`.ref-item`, tabbed by range) ✅
- **42** glossary terms (`.gloss-item`, live search) ✅
- 30 math expressions, 6 tables, 10 SVG diagrams, all chapter prose.

## 13. Build / lint / a11y issues found

- No build/lint/typecheck exists (static site).
- Math unrendered (§10).
- No dark mode; SVGs/diagrams hardcode hex → not theme-able.
- Boletines feed: no skeleton/empty state.
- 3 unused image assets.
- Accessibility: icon-only `#navToggle` — needs verify for aria-label; reveal animations don't check `prefers-reduced-motion`.

---

**Verdict:** content-complete and faithful site, but a single static file with light-only theme, unrendered math, and a working live feed. All real data for the new historical section already exists locally + remotely. Safe to rebuild without inventing anything.
