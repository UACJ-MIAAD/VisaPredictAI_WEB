// AZ5 / US I1 — pure panel parsing + domain labels, shared by the Web Worker
// (lib/data/panel-worker.ts), the inline fallback in visa-panel.ts AND the
// Netlify chat function (server-side synthetic-context recompute, PENDIENTES
// #30). Plain ESM on purpose: the function bundles under plain Node (same
// convention as retrieval-core.mjs / site-stats.generated.mjs). Types live in
// panel-core.d.mts; the TS surface is re-exported by panel-core.ts.
// No DOM, no fetch: text in → Panel out. NO fabrication: missing cells stay
// null and surface as honest empty states.

const BLOCK_ES = {
  employment: "empleo",
  family: "familia",
};

// Pilot coverage (single source of truth — analytics, explorer, hero and the
// server-side synthetic rebuild derive from it).
export const PILOT = ["mexico", "india", "china", "philippines", "all_chargeability"];

export const COUNTRY_LABEL = {
  mexico: "México",
  india: "India",
  china: "China",
  philippines: "Filipinas",
  all_chargeability: "All Chargeability",
  row: "Resto del mundo",
};
const COUNTRY_LABEL_EN = {
  mexico: "Mexico",
  india: "India",
  china: "China",
  philippines: "Philippines",
  all_chargeability: "All Chargeability",
  row: "Rest of the world",
};
// G3: lang opcional para no tocar a los llamadores ES; la versión EN traduce al render.
export const countryLabel = (c, lang) =>
  (lang === "en" ? COUNTRY_LABEL_EN[c] : COUNTRY_LABEL[c]) || c;

// CSV is comma-separated with no quoted fields (values are ISO dates / codes).
// Exported for unit tests (BC2); production callers go through buildPanel.
export function parseCsv(text) {
  const lines = text.split("\n");
  const header = lines[0].split(",");
  const idx = (k) => {
    const i = header.indexOf(k);
    if (i === -1) throw new Error(`CSV missing column: ${k}`); // fail loud, not silent-empty
    return i;
  };
  const iCountry = idx("country");
  const iBlock = idx("block");
  const iCat = idx("category");
  const iTable = idx("table");
  const iDate = idx("bulletin_date");
  const iStatus = idx("status");
  const iPrio = idx("priority_date");
  const iDays = idx("days_since_base");

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.split(",");
    const days = c[iDays];
    // explicit emptiness check so a legitimate "0" survives; NaN → null
    const n = days === "" || days == null ? NaN : Number(days);
    rows.push({
      country: c[iCountry],
      block: BLOCK_ES[c[iBlock]] || c[iBlock],
      category: c[iCat],
      table: c[iTable],
      bulletinMonth: (c[iDate] || "").slice(0, 7),
      status: c[iStatus],
      priorityDate: c[iPrio] || null,
      daysSinceBase: Number.isFinite(n) ? n : null,
      movement: null,
    });
  }
  return rows;
}

// Δ days vs the previous month within the same (country, category, table) series.
// Exported for unit tests (BC2); production callers go through buildPanel.
export function computeMovement(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.country}|${r.category}|${r.table}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)).push(r);
  }
  for (const series of byKey.values()) {
    series.sort((a, b) => a.bulletinMonth.localeCompare(b.bulletinMonth));
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1].daysSinceBase;
      const cur = series[i].daysSinceBase;
      if (prev != null && cur != null) series[i].movement = cur - prev;
    }
  }
}

export function buildPanel(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("CSV vacío");
  computeMovement(rows);

  const statusCounts = {};
  const countries = new Set();
  const categories = new Set();
  const tables = new Set();
  let minM = "9999-99";
  let maxM = "0000-00";
  for (const r of rows) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    countries.add(r.country);
    categories.add(r.category);
    tables.add(r.table);
    if (r.bulletinMonth < minM) minM = r.bulletinMonth;
    if (r.bulletinMonth > maxM) maxM = r.bulletinMonth;
  }
  return {
    rows,
    countries: [...countries].sort(),
    categories: [...categories].sort(),
    tables: [...tables].sort(),
    statusCounts,
    monthRange: [minM, maxM],
  };
}

export const PANEL_CSV_URL = "/data/visa_panel_long.csv";

// Browser/worker fetch helper. Lives HERE (not in the .ts wrapper) on purpose:
// extensionless imports of "./panel-core" can resolve to this .mjs first, and
// the worker bundle did exactly that in prod (2026-07-12 incident: the split
// left fetchPanelText in the .ts wrapper only -> TypeError -> dead panel).
// Whatever file the resolver picks, the full surface must exist.
export async function fetchPanelText() {
  const r = await fetch(PANEL_CSV_URL);
  if (!r.ok) throw new Error(`CSV HTTP ${r.status}`);
  return r.text();
}
