// Real historical panel loader. Source: /data/visa_panel_long.csv — the
// processed panel from the UACJ-MIAAD/VisaPredictAI repo (audit §9).
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

// Pilot coverage (single source of truth — analytics, explorer and hero derive from it).
export const PILOT = ["mexico", "india", "china", "philippines", "all_chargeability"];

// CSV is comma-separated with no quoted fields (values are ISO dates / codes).
function parseCsv(text: string): VisaPanelRow[] {
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
function computeMovement(rows: VisaPanelRow[]): void {
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

let cache: Promise<Panel> | null = null;

export function loadPanel(): Promise<Panel> {
  if (cache) return cache;
  cache = fetch("/data/visa_panel_long.csv")
    .then((r) => {
      if (!r.ok) throw new Error(`CSV HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => {
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
    })
    .catch((e) => {
      cache = null; // allow retry
      throw e;
    });
  return cache;
}

export const COUNTRY_LABEL: Record<string, string> = {
  mexico: "México",
  india: "India",
  china: "China",
  philippines: "Filipinas",
  all_chargeability: "All Chargeability",
  row: "Resto del mundo",
};
const COUNTRY_LABEL_EN: Record<string, string> = {
  mexico: "Mexico",
  india: "India",
  china: "China",
  philippines: "Philippines",
  all_chargeability: "All Chargeability",
  row: "Rest of the world",
};
// G3: lang opcional para no tocar a los llamadores ES; la versión EN traduce al render.
export const countryLabel = (c: string, lang?: string) =>
  (lang === "en" ? COUNTRY_LABEL_EN[c] : COUNTRY_LABEL[c]) || c;
// El parseo guarda block en ES ("empleo"/"familia"); traducir SOLO al mostrar.
const BLOCK_EN: Record<string, string> = { empleo: "employment", familia: "family" };
export const blockLabel = (b: string, lang?: string) => (lang === "en" ? BLOCK_EN[b] || b : b);

// Single source of truth for status/movement colors (was duplicated ×3).
export function statusColor(s: string): string {
  return s === "F"
    ? "var(--color-success)"
    : s === "U"
      ? "var(--color-danger)"
      : s === "C"
        ? "var(--color-accent)"
        : "var(--color-muted)";
}
export function movementColor(n: number): string {
  return n > 0
    ? "var(--color-success)"
    : n < 0
      ? "var(--color-danger)"
      : "var(--color-muted)";
}
