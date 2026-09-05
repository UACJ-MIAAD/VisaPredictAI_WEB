import { describe, expect, it } from "vitest";
import {
  PAUSED_TRACK,
  PLAN_EPICS,
  PLAN_META,
  PLAN_UPDATES,
  STATUS_WEIGHT,
  epicStats,
  planStats,
} from "@/lib/plan-data";

describe("public MLOps plan", () => {
  it("calculates progress from stories instead of a handwritten percentage", () => {
    const stats = planStats();
    expect(stats).toEqual({
      total: 61,
      completed: 26,
      advanced: 27,
      observing: 1,
      deferred: 2,
      planned: 32,
      percent: 44,
    });
  });

  it("keeps every epic and story id unique", () => {
    const epicIds = PLAN_EPICS.map((epic) => epic.id);
    const storyIds = PLAN_EPICS.flatMap((epic) => epic.stories.map((item) => item.id));
    expect(new Set(epicIds).size).toBe(epicIds.length);
    expect(new Set(storyIds).size).toBe(storyIds.length);
  });

  it("has complete bilingual copy", () => {
    for (const epic of PLAN_EPICS) {
      expect(epic.title.es).toBeTruthy();
      expect(epic.title.en).toBeTruthy();
      expect(epic.summary.es).toBeTruthy();
      expect(epic.summary.en).toBeTruthy();
      for (const item of epic.stories) {
        expect(item.title.es).toBeTruthy();
        expect(item.title.en).toBeTruthy();
        expect(item.outcome.es).toBeTruthy();
        expect(item.outcome.en).toBeTruthy();
      }
    }
  });

  it("shows D7 as observation 0/2 and does not call it completed", () => {
    const d7 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "D7");
    expect(d7).toMatchObject({ status: "observing", evidence: "80b3bfb · 0/2" });
    expect(PLAN_META.observation).toEqual({ current: 0, target: 2 });
  });

  it("never advertises work as local or pending integration on the public plan", () => {
    const surfaces = PLAN_EPICS.flatMap((epic) => epic.stories).map((item) => item.evidence ?? "");
    expect(surfaces.some((value) => /local|pendiente|pending/i.test(value))).toBe(false);
  });

  it("keeps the paused R9 track outside the active denominator", () => {
    expect(PAUSED_TRACK.status).toBe("paused");
    expect(PLAN_EPICS.some((epic) => epic.id === PAUSED_TRACK.id)).toBe(false);
    expect(STATUS_WEIGHT.paused).toBe(0);
  });

  it("derives each epic percentage with the same public weighting", () => {
    const platform = PLAN_EPICS.find((epic) => epic.id === "D");
    expect(platform && epicStats(platform)).toEqual({ total: 9, completed: 6, percent: 75 });
  });

  it("shows D9 as delivered with the squash that carries it on main", () => {
    const d9 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "D9");
    expect(d9).toMatchObject({ status: "done", evidence: "494bcfd" });
  });

  it("points the web dashboard at the web main that actually serves it", () => {
    expect(PLAN_META.webMain).toBe("f392bd7122e81dcac1bf66acb54149a4d6e0219e");
    expect(PLAN_META.dataMain).toBe("494bcfd89e333777a028e9c6b610ac15ee7cbbac");
  });

  it("leads the updates feed with the D9 architecture entry", () => {
    expect(PLAN_UPDATES[0]).toMatchObject({ date: "2026-09-04", status: "done" });
    expect(PLAN_UPDATES[0].title.es).toContain("D9");
    expect(PLAN_UPDATES[0].title.en).toContain("D9");
  });
});
