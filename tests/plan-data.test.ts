import { describe, expect, it } from "vitest";
import type { PlanStatus } from "@/lib/plan-data";
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
  it("derives every published counter from the stories and the public weighting", () => {
    // Nada se teclea: el esperado se recalcula aquí con la misma regla que la página publica.
    const stories = PLAN_EPICS.flatMap((epic) => epic.stories);
    const count = (...states: PlanStatus[]) =>
      stories.filter((item) => states.includes(item.status)).length;
    const points = stories.reduce((sum, item) => sum + STATUS_WEIGHT[item.status], 0);
    expect(planStats()).toEqual({
      total: stories.length,
      completed: count("done"),
      advanced: count("done", "observing", "active"),
      observing: count("observing"),
      deferred: count("deferred"),
      planned: count("planned"),
      percent: Math.round((points / stories.length) * 100),
    });
  });

  it("keeps the published weighting the page describes", () => {
    expect(STATUS_WEIGHT).toEqual({
      done: 1,
      observing: 0.75,
      active: 0.5,
      planned: 0,
      deferred: 0,
      paused: 0,
    });
  });

  it("keeps every epic and story id unique", () => {
    const epicIds = PLAN_EPICS.map((epic) => epic.id);
    const storyIds = PLAN_EPICS.flatMap((epic) => epic.stories.map((item) => item.id));
    expect(new Set(epicIds).size).toBe(epicIds.length);
    expect(new Set(storyIds).size).toBe(storyIds.length);
  });

  it("never calls the archived snapshots bulletins", () => {
    // 300 son INSTANTÁNEAS archivadas; los meses del panel son 298 (hecho canónico
    // `n_months`). Llamar «boletines» a las 300 confunde dos hechos distintos, y el guardián
    // de consistencia del repo de datos rechaza esa forma desde M33.
    const prose = [
      ...PLAN_EPICS.flatMap((epic) => [
        epic.title.es, epic.title.en, epic.summary.es, epic.summary.en,
        ...epic.stories.flatMap((s) => [s.title.es, s.title.en, s.outcome.es, s.outcome.en]),
      ]),
      ...PLAN_UPDATES.flatMap((u) => [u.title.es, u.title.en, u.detail.es, u.detail.en]),
    ];
    const offenders = prose.filter((line) => /\b300\s+(?:boletines|bulletins)\b/i.test(line));
    expect(offenders).toEqual([]);
  });

  it("keeps the A7 story as the only place that states both counts", () => {
    const stories = PLAN_EPICS.flatMap((epic) => epic.stories);
    const withCounts = stories.filter((s) => /\b300\b/.test(s.outcome.es) || /\b300\b/.test(s.outcome.en));
    expect(withCounts.map((s) => s.id)).toEqual(["A7"]);
    const a7 = withCounts[0];
    // los dos números, cada uno con su unidad correcta
    expect(a7.outcome.es).toMatch(/300\s+snapshots/);
    expect(a7.outcome.es).toMatch(/298\s+meses/);
    expect(a7.outcome.en).toMatch(/300\s+snapshots/);
    expect(a7.outcome.en).toMatch(/298\s+months/);
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

  it("never presents delivered work as local or pending", () => {
    // Una historia `done` cita el squash que la lleva en main; solo lo que sigue en curso
    // puede declararse local, y así el lector distingue publicado de trabajo en vuelo.
    const delivered = PLAN_EPICS.flatMap((epic) => epic.stories).filter((item) => item.status === "done");
    expect(delivered.some((item) => /local|pendiente|pending/i.test(item.evidence ?? ""))).toBe(false);
  });

  it("keeps the paused R9 track outside the active denominator", () => {
    expect(PAUSED_TRACK.status).toBe("paused");
    expect(PLAN_EPICS.some((epic) => epic.id === PAUSED_TRACK.id)).toBe(false);
    expect(STATUS_WEIGHT.paused).toBe(0);
  });

  it("derives each epic percentage with the same public weighting", () => {
    for (const epic of PLAN_EPICS) {
      const points = epic.stories.reduce((sum, item) => sum + STATUS_WEIGHT[item.status], 0);
      expect(epicStats(epic)).toEqual({
        total: epic.stories.length,
        completed: epic.stories.filter((item) => item.status === "done").length,
        percent: Math.round((points / epic.stories.length) * 100),
      });
    }
  });

  it("shows C2 as delivered with the squash that carries it on main", () => {
    const c2 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "C2");
    expect(c2).toMatchObject({ status: "done", evidence: "25722fe" });
  });

  it("shows C1 as delivered with the squash that carries it on main", () => {
    const c1 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "C1");
    expect(c1).toMatchObject({ status: "done", evidence: "5fa14fa" });
  });

  it("points dataMain at the most recent delivered story, not at an older one", () => {
    // `dataMain` es el corte de datos vigente: debe coincidir con la evidencia de ALGUNA
    // historia entregada (la última que se mergeó), no con la de cualquiera.
    const delivered = PLAN_EPICS.flatMap((epic) => epic.stories)
      .filter((item) => item.status === "done" && item.evidence)
      .map((item) => item.evidence as string);
    expect(delivered.some((sha) => PLAN_META.dataMain.startsWith(sha))).toBe(true);
  });

  it("shows D8 as delivered with the squash that carries it on main", () => {
    const d8 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "D8");
    expect(d8).toMatchObject({ status: "done", evidence: "5dd424b" });
  });

  it("shows D9 as delivered with the squash that carries it on main", () => {
    const d9 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "D9");
    expect(d9).toMatchObject({ status: "done", evidence: "494bcfd" });
  });

  it("names the two commits the plan reports on, in full", () => {
    // `dataMain` es el corte de datos que el plan describe; `webMain` es el commit del sitio
    // desde el que se escribió esta versión (siempre el anterior al que la publica).
    expect(PLAN_META.dataMain).toBe("25722fe280482a9b12947d7b4c3bdd315e74bc1e");
    expect(PLAN_META.webMain).toBe("ad3a0a0403112ca2a621fca5842ed0585db34830");
    for (const sha of [PLAN_META.dataMain, PLAN_META.webMain]) {
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it("leads the updates feed with the newest entry and keeps it in step with the epics", () => {
    const [latest] = PLAN_UPDATES;
    const dates = PLAN_UPDATES.map((item) => item.date);
    expect([...dates].sort().reverse()).toEqual(dates); // el feed va de lo nuevo a lo viejo
    const story = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) =>
      latest.title.es.startsWith(item.id),
    );
    expect(story?.status).toBe(latest.status); // el titular no puede adelantar al estado real
  });
});
