/** Frozen source record from the governed cut, distinct from today's calendar expectation. */
import { ingestionProblems, parseIngestionRecord } from "./ingestion-contract.mjs";

export const SOURCE_STATUSES = ["ok", "blocked", "partial", "offline"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];
export type SourceState =
  | { kind: "absent" }
  | { kind: SourceStatus; since: string; reason: string | null; expectedMonth: string;
      panelVintage: string | null; missingMonths: string[] };
export type SourceView = SourceState | { kind: "loading" | "invalid" | "unavailable" };

export async function loadSourceState(fetcher: typeof fetch = fetch): Promise<SourceView> {
  let body: string;
  try {
    const response = await fetcher("/data/ingestion_state.json");
    if (response.status === 404) return { kind: "absent" };
    if (!response.ok) return { kind: "unavailable" };
    body = await response.text();
  } catch {
    return { kind: "unavailable" };
  }
  try { return parseSourceStatus(body); } catch { return { kind: "invalid" }; }
}

export function deriveSourceStatus(raw: unknown): SourceState {
  if (raw === null || raw === undefined) return { kind: "absent" };
  const problems = ingestionProblems(raw);
  if (problems.length) throw new Error(`ingestion_state: ${problems.join("; ")}`);
  const s = raw as Record<string, unknown>;
  return { kind: s.status as SourceStatus, since: s.status_since as string,
    reason: (s.reason as string) || null, expectedMonth: s.expected_month as string,
    panelVintage: s.panel_vintage as string | null, missingMonths: s.missing_months as string[] };
}

/** Missing response is absence; a present empty/corrupt body is invalid. */
export function parseSourceStatus(body: string | null | undefined): SourceState {
  if (body === null || body === undefined) return { kind: "absent" };
  return deriveSourceStatus(parseIngestionRecord(body));
}

/** Mirrors the existing ingestion policy: from day 15, expect next month's bulletin.
 * This is a calendar expectation, never evidence that a bulletin has been published.
 */
export function sourceCalendar(state: Exclude<SourceState, { kind: "absent" }>, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(Date.parse(`${today}T00:00:00Z`))
      || new Date(`${today}T00:00:00Z`).toISOString().slice(0, 10) !== today) throw new Error("invalid calendar date");
  const date = new Date(`${today}T00:00:00Z`);
  if (date.getUTCDate() >= 15) date.setUTCMonth(date.getUTCMonth() + 1, 1);
  const expected = date.toISOString().slice(0, 7);
  const pending: string[] = [];
  if (state.panelVintage) {
    let year = Number(state.panelVintage.slice(0, 4));
    let month = Number(state.panelVintage.slice(5, 7));
    while (`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}` < expected) {
      if (++month === 13) { year++; month = 1; }
      pending.push(`${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}`);
    }
  }
  return { expected, pending, stale: state.expectedMonth < expected };
}
