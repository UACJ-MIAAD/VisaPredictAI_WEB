// Type surface for panel-core.mjs (implementation is plain ESM so the Netlify
// chat function can bundle it — see the header of panel-core.mjs). Keep in sync
// BY HAND with the .mjs exports; panel-core.ts re-exports this surface for the
// rest of the TS app.

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

export declare const PILOT: string[];
export declare const COUNTRY_LABEL: Record<string, string>;
export declare function countryLabel(c: string, lang?: string): string;

export declare function parseCsv(text: string): VisaPanelRow[];
export declare function computeMovement(rows: VisaPanelRow[]): void;
export declare function buildPanel(text: string): Panel;

export declare const PANEL_CSV_URL: string;
export declare function fetchPanelText(): Promise<string>;
