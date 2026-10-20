import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deriveSourceStatus, loadSourceState, parseSourceStatus, sourceCalendar } from "../lib/source-status";
import { consumedEntries, planSwap, validateArtifact } from "../lib/release.mjs";

const state = JSON.parse(readFileSync(new URL("./fixtures/ingestion_state.blocked.json", import.meta.url), "utf8"));

describe("C1: the release really serves the source record", () => {
  it("maps the feed into the verified transactional swap", () => {
    const entry = { path: "reports/governance/ingestion_state.json", criticality: "required", sha256: "a".repeat(64), size: 123 };
    expect(consumedEntries({ artifacts: [entry] })).toEqual([{ ...entry, out: "ingestion_state.json" }]);
  });
  it("maps the exact release model card instead of fetching a pre-seal revision", () => {
    expect(consumedEntries({ artifacts: [{ path: "reports/governance/MODEL_CARD.md" }] })).toEqual([
      { path: "reports/governance/MODEL_CARD.md", out: "MODEL_CARD.md" },
    ]);
  });

  it.each([
    { expected_month: "2026-13" }, { status_since: "2026-02-30" },
    { last_attempt: "2026-10-20" }, { n_index_links: true },
    { failed_links: [3] }, { last_success_date: "yesterday" },
  ])("refuses malformed canonical fields: %j", (change) => {
    expect(() => deriveSourceStatus({ ...state, ...change })).toThrow(/ingestion_state/);
  });
});

describe("the calendar does not masquerade as a live source probe", () => {
  it.each([
    ["2026-10-14", "2026-10"], ["2026-10-15", "2026-11"],
    ["2026-10-20", "2026-11"], ["2026-12-20", "2027-01"],
    ["2026-02-14", "2026-02"], ["2026-02-15", "2026-03"],
  ])("applies the day-15 policy on %s", (today, expected) => {
    const parsed = deriveSourceStatus(state);
    if (parsed.kind === "absent") throw new Error("fixture absent");
    expect(sourceCalendar(parsed, today).expected).toBe(expected);
  });
  it("keeps the historical status and exposes its age and separate calendar expectation", () => {
    const parsed = deriveSourceStatus(state);
    if (parsed.kind === "absent") throw new Error("fixture absent");
    expect(sourceCalendar(parsed, "2026-10-20")).toEqual({ expected: "2026-11", pending: ["2026-10", "2026-11"], stale: true });
    expect(parsed).toMatchObject({ kind: "blocked", since: "2026-09-02", expectedMonth: "2026-09" });
  });
  it("does not invent pending panel months when no panel has been recorded", () => {
    const parsed = deriveSourceStatus({ ...state, panel_vintage: null });
    if (parsed.kind === "absent") throw new Error("fixture absent");
    expect(sourceCalendar(parsed, "2026-10-20").pending).toEqual([]);
  });
  it("rejects an invalid injected calendar date", () => {
    const parsed = deriveSourceStatus(state);
    if (parsed.kind === "absent") throw new Error("fixture absent");
    expect(() => sourceCalendar(parsed, "2026-02-30")).toThrow();
  });
});

describe("the UI and build loader use the same closed schema", () => {
  it("refuses duplicated and escaped duplicated keys", () => {
    for (const key of ['"schema"', '"sch\\u0065ma"']) {
      const body = JSON.stringify(state).replace('{', `{${key}:1,`);
      expect(() => parseSourceStatus(body)).toThrow(/duplicada/);
      expect(validateArtifact({ artifact: "reports/governance/ingestion_state.json" }, Buffer.from(body))).not.toBe(true);
    }
  });
  it("does not confuse quoted JSON in a reason with a duplicate key", () => {
    expect(parseSourceStatus(JSON.stringify({ ...state, reason: 'error: "schema": 2' })).kind).toBe("blocked");
  });
  it("refuses invalid UTF-8 before the build swaps bytes", () => {
    const body = Buffer.concat([Buffer.from(JSON.stringify(state).slice(0, -1)), Buffer.from([255]), Buffer.from('}')]);
    expect(validateArtifact({ artifact: "reports/governance/ingestion_state.json" }, body)).not.toBe(true);
  });
  it("a rejected required feed vetoes the whole transactional swap", () => {
    const entries = consumedEntries({ artifacts: [{ path: "reports/governance/ingestion_state.json", criticality: "required" }] });
    expect(planSwap(entries, new Map([["ingestion_state.json", "corrupt"]])).swap).toBe(false);
    expect(planSwap(entries, new Map([["ingestion_state.json", true]])).swap).toBe(true);
  });
  it("distinguishes absence, transport failure and an invalid body", async () => {
    const fetcher = (status: number, body: string) => (async () => new Response(body, { status })) as typeof fetch;
    expect(await loadSourceState(fetcher(404, "missing"))).toEqual({ kind: "absent" });
    expect(await loadSourceState(fetcher(503, "unavailable"))).toEqual({ kind: "unavailable" });
    expect(await loadSourceState(fetcher(200, "{}"))).toEqual({ kind: "invalid" });
    expect(await loadSourceState(fetcher(200, ""))).toEqual({ kind: "invalid" });
    expect(await loadSourceState((async () => { throw new Error("offline"); }) as typeof fetch)).toEqual({ kind: "unavailable" });
  });
});
