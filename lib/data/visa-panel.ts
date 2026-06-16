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

// CSV is comma-separated with no quoted fields (values are ISO dates / codes).
function parseCsv(text: string): VisaPanelRow[] {
  const lines = text.split("\n");
  const header = lines[0].split(",");
  const idx = (k: string) => header.indexOf(k);
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
    rows.push({
      country: c[iCountry],
      block: BLOCK_ES[c[iBlock]] || c[iBlock],
      category: c[iCat],
      table: c[iTable],
      bulletinMonth: (c[iDate] || "").slice(0, 7),
      status: c[iStatus],
      priorityDate: c[iPrio] || null,
      daysSinceBase: days ? Number(days) : null,
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
export const countryLabel = (c: string) => COUNTRY_LABEL[c] || c;
