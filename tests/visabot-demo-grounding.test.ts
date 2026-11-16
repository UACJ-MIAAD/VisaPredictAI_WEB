import { describe, expect, it } from "vitest";
import { pinGrounding } from "@/lib/visabot/retrieval-core.mjs";
import { systemPrompt, topicReminders } from "../netlify/functions/chat.mjs";

// Rehearsal of the conference demo questions (15-nov-2026), graded by an
// independent agent against the served artifacts. Each case is a question
// production answered wrongly, reduced to the rule that was missing.

const CHUNKS = [
  { kind: "academic", lang: "es", sourceId: "resumen", title: "Resumen", text: "x" },
  { kind: "docs", lang: "es", sourceId: "ingenieria", title: "5. Evaluación", text: "mcs" },
  { kind: "docs", lang: "en", sourceId: "ingenieria", title: "5. Evaluación", text: "mcs" },
  { lang: "es", title: "Cifras canónicas del sistema", text: "Series estructurales: 194" },
];
const titles = (idx: number[]) => idx.map((i) => CHUNKS[i].title);

describe("cutoff rule: only a priority date EARLIER than the cutoff is current", () => {
  for (const lang of ["es", "en"] as const) {
    const p = systemPrompt(lang, [], "console", "");
    it(`${lang}: the prompt never treats an equal date as current`, () => {
      expect(p).not.toMatch(lang === "es" ? /ANTERIOR o igual/ : /EARLIER than or equal/);
      expect(p).toMatch(lang === "es" ? /estrictamente ANTERIOR/ : /strictly EARLIER/);
    });
  }
});

describe("demo reminders", () => {
  it.each(["es", "en"] as const)("%s: acronyms are defined even for a question about error metrics", (lang) => {
    const p = systemPrompt(lang, [], "console", "What error metrics does the project use?");
    expect(p).toContain("FAD = Final Action Dates; DFF = Dates for Filing");
  });
  it("explicitly supersedes historical leakage-free wording for metric questions", () => {
    expect(topicReminders("en", "What error metrics does the project use?")).toMatch(/current gap-fill caveat supersedes that label/);
    expect(topicReminders("es", "¿Algún modelo le gana a repetir el último corte?")).toMatch(/Separa motivación de diseño de evidencia medida/);
  });
  it("does not promise becoming current next month after equality", () => {
    expect(topicReminders("en", "My priority date equals the cutoff. Am I current?")).toMatch(/does NOT guarantee becoming current the following month/);
  });
  it("C/F/U questions distinguish unavailable numbers from missing data", () => {
    expect(topicReminders("en", "What do C, F and U mean in this database?")).toMatch(/NOT an empty cell or missing data/);
    expect(topicReminders("es", "¿Qué significan C, F y U?")).toMatch(/NO es una celda vacía ni un dato faltante/);
  });
  it("Table A/B: tables are FAD/DFF and DFF does not by itself authorize adjustment", () => {
    for (const q of ["¿Cuál es la diferencia entre Final Action Dates y Dates for Filing?", "¿Qué es el Visa Bulletin?"]) {
      const r = topicReminders("es", q);
      expect(r).toMatch(/Tabla A es Final Action Dates \(FAD\) y la Tabla B es Dates for Filing \(DFF\)/);
      expect(r).toMatch(/USCIS indica cada mes/);
      expect(r).toMatch(/ANTERIOR a la fecha publicada/);
    }
    expect(topicReminders("en", "What is the difference between Final Action Dates and Dates for Filing?")).toMatch(/USCIS states each month/);
  });

  it("'does any model beat repeating the last cutoff?' opens with No", () => {
    const r = topicReminders("es", "¿Algún modelo le gana con significancia a repetir el último corte?");
    expect(r).toMatch(/DIRECCIÓN DE LA PREGUNTA/);
    expect(r).toMatch(/empieza con «No»/);
    expect(r).toMatch(/^- MCS/m);
  });

  it("generic error question: answer with the global figures, never ask first, no RMSE", () => {
    const r = topicReminders("es", "¿Qué tan grande es el error del pronóstico?");
    expect(r).toMatch(/ERROR/);
    expect(r).toMatch(/NO pidas aclaración antes/);
    expect(r).toMatch(/RMSE/);
    expect(titles(pinGrounding([0], CHUNKS, "es", "¿Qué tan grande es el error del pronóstico?"))).toContain("5. Evaluación");
  });

  it("forecast chart: global track record is not the series' error nor '12 validated months'", () => {
    const r = topicReminders("es", "Muéstrame el pronóstico de México F2B en Final Action Dates");
    expect(r).toMatch(/GLOBALES de todas las series/);
    expect(r).toMatch(/sigue pendiente/);
  });

  it("winner question separates the hold-out winner from the deployed recipe and calls the walk-forward expanding", () => {
    const r = topicReminders("es", "¿Qué modelos compara el proyecto y cuál gana?");
    expect(r).toMatch(/GANADOR/);
    expect(r).toMatch(/expansiva/);
  });

  it("methodology: CRISP-DM is presented as completed, not as an early-stage plan", () => {
    const r = topicReminders("es", "¿Qué metodología sigue el proyecto?");
    expect(r).toMatch(/CRISP-DM/);
    expect(r).toMatch(/aún no aplica/);
  });

  it("bulletin changes: highlight by magnitude, not by table order", () => {
    expect(topicReminders("es", "¿Qué cambió en el boletín de noviembre 2026?")).toMatch(/magnitud en días/);
  });

  it("follow-up comparisons: no 'advances more' claim without day counts from the sources", () => {
    expect(topicReminders("es", "¿y para India?")).toMatch(/COMPARACIONES/);
  });

  it("Carbon review: the verb 'significan' does not trigger the naïve rule; 'avances' and 'confiable' do trigger theirs", () => {
    expect(topicReminders("es", "¿Qué significan las bandas del 80 % y del 95 % del pronóstico?")).not.toMatch(/DIRECCIÓN DE LA PREGUNTA/);
    expect(topicReminders("es", "¿Hubo avances en noviembre?")).toMatch(/magnitud en días/);
    expect(titles(pinGrounding([0], CHUNKS, "es", "¿Qué tan confiable es el pronóstico?"))).toContain("5. Evaluación");
  });

  it("the base prompt no longer calls the horizon 'validated months'", () => {
    expect(systemPrompt("es", [], "console", "")).not.toMatch(/meses validados/);
    expect(systemPrompt("en", [], "console", "")).not.toMatch(/validated \d+ months/);
  });

  it("preview run: database counts come from the fact sheet and are never swapped", () => {
    const q = "¿Cuántos registros y series tiene la base de datos?";
    expect(titles(pinGrounding([0], CHUNKS, "es", q))).toContain("Cifras canónicas del sistema");
    expect(topicReminders("es", q)).toMatch(/Nunca intercambies series, observaciones y boletines/);
  });

  it("round 3: bands read the right way, no invented causes, no misread Holm line, no mixed bulletin lines", () => {
    const b = topicReminders("es", "¿Qué significan las bandas del 80 % y del 95 % del pronóstico?");
    expect(b).toMatch(/NOMINALES/);
    expect(b).toMatch(/ANTES del límite inferior, es muy probable/);
    expect(b).toMatch(/no digas que «probablemente» la alcance/);
    expect(topicReminders("es", "¿Qué tan grande es el error del pronóstico?")).toMatch(/nunca digas que esas cifras son «desde julio de 2026»/);
    expect(topicReminders("es", "Muéstrame el pronóstico de México F2B")).toMatch(/es el de ESA serie/);
    expect(topicReminders("es", "Muéstrame el pronóstico de México F2B")).toMatch(/volatilidad/);
    expect(topicReminders("es", "¿Qué modelos compara el proyecto y cuál gana?")).toMatch(/no sobrevive a Holm/);
    expect(topicReminders("es", "¿Qué cambió en el boletín de noviembre 2026?")).toMatch(/nunca combines la categoría de una línea con la fecha de otra/);
  });

  it("leaves unrelated questions without reminders", () => {
    expect(topicReminders("es", "¿Qué es la retrogresión?")).toBe("");
  });
});
