// AZ5 — pure panel parsing, shared by the Web Worker (lib/data/panel-worker.ts)
// and the inline fallback in visa-panel.ts. US I1 moved the implementation to
// panel-core.mjs (plain ESM) so the Netlify chat function can ALSO run it for
// the server-side synthetic-context recompute (PENDIENTES #30) — single source,
// no server/client divergence. This module keeps the typed TS surface (types in
// panel-core.d.mts) plus the browser-only fetch helper.

export {
  parseCsv,
  computeMovement,
  buildPanel,
  fetchPanelText,
  PANEL_CSV_URL,
} from "./panel-core.mjs";
export type { Panel, VisaPanelRow } from "./panel-core.mjs";
