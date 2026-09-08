import { describe, expect, it } from "vitest";
import type { PlanEpic, PlanStatus, PlanUpdate } from "@/lib/plan-data";
import {
  PAUSED_TRACK,
  PLAN_EPICS,
  PLAN_META,
  PLAN_UPDATES,
  STATUS_WEIGHT,
  epicStats,
  groupUpdatesByDay,
  planFocus,
  planStats,
} from "@/lib/plan-data";

/** Copia profunda del plan: las mutaciones de una prueba jamás tocan el plan publicado. */
const clonePlan = (): PlanEpic[] => structuredClone(PLAN_EPICS) as PlanEpic[];
const cloneUpdates = (): PlanUpdate[] => structuredClone(PLAN_UPDATES) as PlanUpdate[];
const findStory = (epics: PlanEpic[], id: string) => {
  const story = epics.flatMap((epic) => epic.stories).find((item) => item.id === id);
  if (!story) throw new Error(`la historia ${id} no existe en el plan`);
  return story;
};

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

  it("shows C3 as delivered with the squash that carries it on main", () => {
    const c3 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "C3");
    expect(c3).toMatchObject({ status: "done", evidence: "bb64647" });
  });

  it("shows C2 as delivered with the squash that carries it on main", () => {
    const c2 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "C2");
    expect(c2).toMatchObject({ status: "done", evidence: "25722fe" });
  });

  it("shows C1 as delivered with the squash that carries it on main", () => {
    const c1 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "C1");
    expect(c1).toMatchObject({ status: "done", evidence: "5fa14fa" });
  });

  it("never lets a story point at a data main that moved past it", () => {
    // `dataMain` es el corte de datos VIGENTE y no siempre corresponde a una historia: también
    // avanza con mantenimiento (p. ej. endurecer una regla del guardián). Lo que sí debe
    // cumplirse es que, si una evidencia coincide con él, esa historia esté entregada.
    const stories = PLAN_EPICS.flatMap((epic) => epic.stories);
    const pointing = stories.filter((item) => item.evidence && PLAN_META.dataMain.startsWith(item.evidence));
    for (const story of pointing) {
      expect(story.status).toBe("done");
    }
    // y ninguna evidencia de historia entregada puede ser un prefijo vacío o de otra longitud
    for (const story of stories.filter((s) => s.status === "done" && s.evidence)) {
      expect(story.evidence).toMatch(/^(?:[0-9a-f]{7}|release\/[\w.-]+)$/);
    }
  });

  it.each(["F7", "F8"])("shows %s as delivered with the squash that carries it on main", (id) => {
    const historia = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === id);
    expect(historia).toMatchObject({ status: "done", evidence: "1c81b6f" });
  });

  it("keeps F5 under observation, with its dependency named", () => {
    // La parte viable está puesta; lo que falta depende de la campaña causal (F2-causal/#33),
    // así que declararla entregada sería adelantarse a un resultado que no existe.
    const f5 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "F5");
    expect(f5).toMatchObject({ status: "observing" });
    expect(f5?.evidence).toMatch(/^7925dae · /);
    expect(f5?.evidence).toMatch(/campa[ñn]a causal/);
  });

  it("keeps F2 under observation until a governed cut publishes the feed", () => {
    // El paso de datos entró (spec + gate), pero el corte vigente no trae el artefacto y no se
    // regenera: la historia no puede declararse entregada hasta que un corte lo publique.
    const f2 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "F2");
    expect(f2).toMatchObject({ status: "observing" });
    // Antes esto exigía que la evidencia de F2 fuera prefijo de `dataMain`. Solo era cierto
    // porque `dataMain` se había quedado congelado en el corte de F2: la prueba consagraba el
    // fallo. La propiedad real es que F2 declara SU corte y su dependencia, no la punta de main.
    expect(f2?.evidence).toMatch(/^[0-9a-f]{7} · /);
    expect(f2?.evidence).toMatch(/corte gobernado$/);
  });

  it("cites no data commit for work that lives entirely in the web repo", () => {
    // Precedente de la épica B, cuyas seis historias son de este repositorio: `evidence` es
    // opcional y se omite. Poner un sha de este repo lo haría pasar por uno del de datos, y
    // el lector iría a buscarlo donde no está.
    const porId = new Map(PLAN_EPICS.flatMap((epic) => epic.stories).map((item) => [item.id, item]));
    expect(porId.get("F1")).toMatchObject({ status: "done" });
    expect(porId.get("F1")?.evidence).toBeUndefined();
    expect(porId.get("B4")?.evidence).toBeUndefined();
  });

  it("shows D8 as delivered with the squash that carries it on main", () => {
    const d8 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "D8");
    expect(d8).toMatchObject({ status: "done", evidence: "5dd424b" });
  });

  it("shows D9 as delivered with the squash that carries it on main", () => {
    const d9 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "D9");
    expect(d9).toMatchObject({ status: "done", evidence: "494bcfd" });
  });

  it("names the data commit the plan reports on, in full", () => {
    // `dataMain` es el corte de datos que el plan describe. `webMain` se retiró: pretendía nombrar
    // el commit que lo contiene, lo cual es circular, y ningún componente lo consumía.
    expect(PLAN_META.dataMain).toBe("1c81b6fd57ae74429c75d294b3e5caef91ac782b");
    expect(PLAN_META.dataMain).toMatch(/^[0-9a-f]{40}$/);
    expect(PLAN_META).not.toHaveProperty("webMain");
  });

  it("keeps in PLAN_META only what the plan cannot derive", () => {
    // Cablear aquí la fase, la siguiente historia o la fecha es lo que dejó la cabecera
    // anunciando «D9 → D8» meses después de entregar ambas épicas.
    expect(Object.keys(PLAN_META).sort()).toEqual([
      "dataMain",
      "observation",
      "releaseId",
      "releaseStatus",
    ]);
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

  describe("daily progress log", () => {
    it("creates one section per day, newest first, without losing any update", () => {
      const days = groupUpdatesByDay();
      const dates = days.map((day) => day.date);
      expect(new Set(dates).size).toBe(dates.length);
      expect(dates).toEqual([...dates].sort().reverse());
      expect(days.flatMap((day) => day.updates)).toEqual(PLAN_UPDATES);
      for (const day of days) {
        expect(day.updates.every((update) => update.date === day.date)).toBe(true);
      }
    });

    it("sorts unordered days but preserves the editorial order within each day", () => {
      const updates = cloneUpdates();
      // Derivado del propio registro: el día más reciente y las entradas que le pertenecen.
      // Fijar la fecha a mano obligaba a editar esta prueba en cada entrada nueva.
      const masReciente = [...updates].map((update) => update.date).sort().at(-1);
      const firstDay = updates.filter((update) => update.date === masReciente);
      const unordered = [updates.at(-1)!, ...updates.slice(0, -1)];
      const days = groupUpdatesByDay(unordered);
      expect(days[0].date).toBe(masReciente);
      expect(days[0].updates).toEqual(firstDay);
    });

    it("does not mutate the updates it receives", () => {
      const updates = cloneUpdates();
      const before = JSON.stringify(updates);
      groupUpdatesByDay(updates);
      expect(JSON.stringify(updates)).toBe(before);
    });
  });

  describe("focus derived from the plan itself", () => {
    it("points at the first story nobody has started, and at the epic holding it", () => {
      // Propiedad, no literal: nombrar la historia obligaba a editar esta prueba en cada
      // entrega, y ya se hizo en C5, C7, C8 y C9. Lo que se afirma es el orden.
      // La regla del selector: manda la historia EN CURSO si la hay, y si no la primera sin
      // empezar. Se afirma esa propiedad, no un identificador: nombrarlo obligaba a editar
      // esta prueba en cada entrega, y ya pasó en C5, C7, C8 y C9.
      const focus = planFocus();
      const orden = PLAN_EPICS.flatMap((epic) => epic.stories);
      const enCurso = orden.filter((story) => story.status === "active");
      if (enCurso.length > 0) {
        expect(focus.next?.id).toBe(enCurso[0].id);
      } else {
        const posicion = orden.findIndex((story) => story.id === focus.next?.id);
        expect(focus.next?.status).toBe("planned");
        expect(orden.slice(0, posicion).every((story) => story.status !== "planned")).toBe(true);
      }
      expect(focus.epic.stories.some((story) => story.id === focus.next?.id)).toBe(true);
    });

    it("prefers the story in flight over the first one nobody has started", () => {
      const epics = clonePlan();
      const siguiente = planFocus(epics, cloneUpdates()).next!;
      findStory(epics, siguiente.id).status = "active";
      expect(planFocus(epics, cloneUpdates()).next?.id).toBe(siguiente.id);
      findStory(epics, siguiente.id).status = "done";
      expect(planFocus(epics, cloneUpdates()).next?.id).not.toBe(siguiente.id);
    });

    it("leaves the epic when its last story is delivered, with no edit to the component", () => {
      const epics = clonePlan();
      const epica = planFocus(epics, cloneUpdates()).epic.id;
      for (const story of epics.find((epic) => epic.id === epica)!.stories) {
        story.status = "done";
      }
      expect(planFocus(epics, cloneUpdates()).epic.id).not.toBe(epica);
      expect(planFocus().epic.id).toBe(epica); // el plan publicado no se movió
    });

    it("shows C4 as delivered with the squash that carries it on main", () => {
      const c4 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "C4");
      expect(c4).toMatchObject({ status: "done", evidence: "df597ff" });
    });

    it("shows C5 as delivered with the squash that carries it on main", () => {
      const c5 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "C5");
      expect(c5).toMatchObject({ status: "done", evidence: "68bf843" });
    });

    it("shows C6 as delivered with the squash that carries it on main", () => {
      const c6 = PLAN_EPICS.flatMap((epic) => epic.stories).find((item) => item.id === "C6");
      expect(c6).toMatchObject({ status: "done", evidence: "17d0ebf" });
    });

    it("marks C7 and C7b as delivered, pointing at the squash that carries them", () => {
      const porId = new Map(PLAN_EPICS.flatMap((epic) => epic.stories).map((s) => [s.id, s]));
      expect(porId.get("C7")).toMatchObject({ status: "done", evidence: "10b100d" });
      expect(porId.get("C7b")).toMatchObject({ status: "done", evidence: "10b100d" });
      expect(porId.get("C8")).toMatchObject({ status: "done", evidence: "309e214" });
      expect(porId.get("C9")).toMatchObject({ status: "done", evidence: "817afc3" });
    });

    it("moves to the next epic once every story in this one is delivered", () => {
      const epics = clonePlan();
      for (const story of epics.find((epic) => epic.id === "C")!.stories) {
        story.status = "done";
      }
      const focus = planFocus(epics, cloneUpdates());
      expect(focus.epic.id).not.toBe("C");
      // Lo que importa es que no proponga trabajo ya entregado; puede estar en curso.
      expect(focus.next?.status).not.toBe("done");
    });

    it("never proposes deferred or paused work as the next step", () => {
      const epics = clonePlan();
      findStory(epics, "C9").status = "deferred";
      expect(planFocus(epics, cloneUpdates()).epic.id).not.toBe("C");
    });

    it("says the plan is complete instead of inventing a next story", () => {
      const epics = clonePlan();
      for (const story of epics.flatMap((epic) => epic.stories)) {
        if (story.status === "planned" || story.status === "active") story.status = "done";
      }
      const focus = planFocus(epics, cloneUpdates());
      expect(focus.next).toBeNull();
      expect(focus.epic).toBeDefined(); // la cabecera sigue teniendo una fase que mostrar
    });

    it("reports the stories under observation and the deferred ones", () => {
      // Derivado: nombrar las historias obligaba a editar esta prueba cada vez que una entra
      // en observación, y F2 fue la segunda. Se afirma que el selector no se inventa nada.
      const todas = PLAN_EPICS.flatMap((epic) => epic.stories);
      const focus = planFocus();
      expect(focus.observing.map((item) => item.id)).toEqual(
        todas.filter((item) => item.status === "observing").map((item) => item.id),
      );
      expect(focus.deferred.map((item) => item.id)).toEqual(
        todas.filter((item) => item.status === "deferred").map((item) => item.id),
      );
      expect(focus.observing.length).toBeGreaterThan(0);
      expect(PLAN_META.observation).toEqual({ current: 0, target: 2 });
    });

    it("takes the update date from the feed, so a newer entry moves it on its own", () => {
      const focus = planFocus();
      const newest = [...PLAN_UPDATES.map((item) => item.date)].sort().pop();
      expect(focus.updatedAt).toBe(newest);

      const updates = cloneUpdates();
      updates.unshift({ ...updates[0], date: "2026-10-01" });
      expect(planFocus(clonePlan(), updates).updatedAt).toBe("2026-10-01");
      expect(planFocus().updatedAt).toBe(newest); // el feed publicado no se movió
    });

    it("reads the newest date even when the feed is out of order", () => {
      const updates = cloneUpdates();
      updates.push({ ...updates[0], date: "2026-12-31" });
      expect(planFocus(clonePlan(), updates).updatedAt).toBe("2026-12-31");
    });

    it("does not mutate the plan it receives", () => {
      const epics = clonePlan();
      const before = JSON.stringify(epics);
      planFocus(epics, cloneUpdates());
      expect(JSON.stringify(epics)).toBe(before);
    });
  });
});
