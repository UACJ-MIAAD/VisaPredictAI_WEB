// AZ5 — pure panel parsing, shared by the Web Worker (lib/data/panel-worker.ts)
// and the inline fallback in visa-panel.ts. No DOM, no fetch: text in → Panel
// out, so it runs identically on the main thread and inside a worker.
// NO fabrication: missing cells stay null and surface as honest empty states.

export type VisaPanelRow = {
  country: string;
  block: "familia" | "empleo" | string;
  category: string;
  table: "FAD" | "DFF" | string;
  bulletinMonth: string; // YYYY-MM
  status: "C" | "F" | "U" | string;
  priorityDate: string | null;
  daysSinceBase: number | null;
  movement: number | null; // Δ days vs previous month in the same series
};

export type Panel = {
  rows: VisaPanelRow[];
  countries: string[];
  categories: string[];
  tables: string[];
  statusCounts: Record<string, number>;
  monthRange: [string, string];
};

const BLOCK_ES: Record<string, string> = {
  employment: "empleo",
  family: "familia",
};

// CSV is comma-separated with no quoted fields (values are ISO dates / codes).
// Exported for unit tests (BC2); production callers go through buildPanel.
export function parseCsv(text: string): VisaPanelRow[] {
  const lines = text.split("\n");
  const header = lines[0].split(",");
  const idx = (k: string) => {
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

  const rows: VisaPanelRow[] = [];
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
export function computeMovement(rows: VisaPanelRow[]): void {
  const byKey = new Map<string, VisaPanelRow[]>();
  for (const r of rows) {
    const k = `${r.country}|${r.category}|${r.table}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(r);
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

export function buildPanel(text: string): Panel {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("CSV vacío");
  computeMovement(rows);

  const statusCounts: Record<string, number> = {};
  const countries = new Set<string>();
  const categories = new Set<string>();
  const tables = new Set<string>();
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
    monthRange: [minM, maxM] as [string, string],
  };
}

export const PANEL_CSV_URL = "/data/visa_panel_long.csv";

export async function fetchPanelText(): Promise<string> {
  const r = await fetch(PANEL_CSV_URL);
  if (!r.ok) throw new Error(`CSV HTTP ${r.status}`);
  return r.text();
}
