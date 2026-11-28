// Current-month cutoffs read from the served panel, so a monthly release never breaks
// tests that only need "the cutoff in force" (Dec 2026: Mexico F2A FAD moved 22APR26 -> 22MAY26).
import type { Panel } from "@/lib/data/panel-core";

export function latestRow(panel: Panel, country: string, category: string, table: string) {
  const rows = panel.rows.filter(r => r.country === country && r.category === category && r.table === table);
  if (rows.length === 0) throw new Error(`no rows for ${country}/${category}/${table}`);
  return rows.reduce((a, b) => (b.bulletinMonth > a.bulletinMonth ? b : a));
}

/** Cutoff date of the latest bulletin; fails loudly if that cell is not a dated (F) cutoff. */
export function latestCutoff(panel: Panel, country: string, category: string, table: string): string {
  const row = latestRow(panel, country, category, table);
  if (row.status !== "F" || !row.priorityDate) throw new Error(`${country}/${category}/${table} is ${row.status} in ${row.bulletinMonth}`);
  return row.priorityDate.slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function lastTwoMonths(panel: Panel): [string, string] {
  const months = [...new Set(panel.rows.map(r => r.bulletinMonth))].sort();
  return [months[months.length - 2], months[months.length - 1]];
}
