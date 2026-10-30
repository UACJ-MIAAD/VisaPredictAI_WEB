import { describe, it, expect, vi, afterEach } from "vitest";
import { pinGrounding } from "@/lib/visabot/retrieval-core.mjs";
import { mergeFollowUp, detectEntities } from "@/lib/visabot/analytics";
import { systemPrompt, topicReminders } from "../netlify/functions/chat.mjs";

// Adversarial audit of the live VisaBot (28-oct-2026): each case below is a
// wrong answer production gave, reduced to the grounding gap that caused it.

const CHUNKS = [
  { kind: "academic", lang: "es", sourceId: "resumen", title: "Resumen", text: "x" },
  { kind: "glossary", lang: "es", sourceId: "glosario", title: "F1, F2A, F2B, F3, F4", text: "familia" },
  { kind: "glossary", lang: "es", sourceId: "glosario", title: "EB-1 a EB-5", text: "empleo" },
  { kind: "glossary", lang: "en", sourceId: "glosario", title: "F1, F2A, F2B, F3, F4", text: "family" },
  { kind: "glossary", lang: "en", sourceId: "glosario", title: "EB-1 to EB-5", text: "employment" },
  { kind: "docs", lang: "es", sourceId: "ingenieria", title: "5. Evaluación", text: "mcs" },
  { kind: "docs", lang: "en", sourceId: "ingenieria", title: "5. Evaluación", text: "mcs" },
  { kind: "docs", lang: "es", sourceId: "ingenieria", title: "Modelo de producción (por qué NO es el \"ganador\" del hold-out) (1/3)", text: "piso" },
  { kind: "docs", lang: "es", sourceId: "ingenieria", title: "Modelo de producción (por qué NO es el \"ganador\" del hold-out) (2/3)", text: "decisión" },
  { kind: "docs", lang: "es", sourceId: "ingenieria", title: "Modelo de producción (por qué NO es el \"ganador\" del hold-out) (3/3)", text: "cpu" },
  { kind: "docs", lang: "es", sourceId: "ingenieria", title: "Estado administrativo (`status`)", text: "C/F/U" },
];
const titles = (sel: number[]) => sel.map((i) => CHUNKS[i].title);

describe("pinGrounding (retrieval-core)", () => {
  it("appends the category glossary to a bulletin question that names no category", () => {
    // the November diff answer defined F1 as "Estudiantes" without this
    const t = titles(pinGrounding([0], CHUNKS, "es", "¿Qué cambió en el boletín de noviembre 2026?"));
    expect(t).toEqual(["Resumen", "F1, F2A, F2B, F3, F4", "EB-1 a EB-5"]);
  });

  it("pins the glossary for a category that does not exist, so F6 is not invented", () => {
    expect(titles(pinGrounding([0], CHUNKS, "es", "Pronóstico de México F6"))).toContain("F1, F2A, F2B, F3, F4");
  });

  it("pins the model card evaluation for an English coverage question", () => {
    const t = titles(pinGrounding([], CHUNKS, "en", "How reliable are your prediction intervals? Give me the coverage numbers."));
    expect(t).toEqual(["5. Evaluación"]);
    expect(pinGrounding([], CHUNKS, "en", "coverage").map((i: number) => CHUNKS[i].lang)).toEqual(["en"]);
  });

  it("pins the production-model rationale (parts 1 and 2 only) for the naïve question", () => {
    const t = titles(pinGrounding([], CHUNKS, "en", "Is it true the naive forecast beats your models?"));
    expect(t.filter((x) => x.startsWith("Modelo de producción"))).toHaveLength(2);
    expect(t.some((x) => x.endsWith("(3/3)"))).toBe(false);
  });

  it("pins the C/F/U definitions for a Current question", () => {
    expect(titles(pinGrounding([], CHUNKS, "es", "¿Qué significa que una categoría esté 'Current'?"))).toContain("Estado administrativo (`status`)");
  });

  it("never reorders or drops the ranked selection and does not duplicate", () => {
    expect(pinGrounding([2, 0], CHUNKS, "es", "F4 México")).toEqual([2, 0, 1]);
  });

  it("leaves unrelated questions untouched", () => {
    expect(pinGrounding([0], CHUNKS, "es", "¿Qué es la retrogresión?")).toEqual([0]);
  });
});

describe("mergeFollowUp (console follow-ups)", () => {
  const panel = { categories: ["F1", "F2A", "F2B", "F3", "F4", "EB2"] } as unknown as Parameters<typeof detectEntities>[1];

  it("lets a follow-up country replace the previous one", () => {
    // "¿y para India?" after México F3 lost India: the first alias in list order won
    const rq = mergeFollowUp("¿Cuándo avanza México F3?", "¿y para India?");
    const e = detectEntities(rq, panel);
    expect(e.country).toBe("india");
    expect(e.category).toBe("F3");
  });

  it("lets a follow-up table replace the previous one", () => {
    const e = detectEntities(mergeFollowUp("Pronóstico de México F4 FAD", "¿y en DFF?"), panel);
    expect(e.table).toBe("DFF");
    expect(e.country).toBe("mexico");
  });

  it("keeps the previous entities when the fragment names none", () => {
    expect(mergeFollowUp("¿Cuándo avanza México F3?", "¿y luego?")).toBe("¿Cuándo avanza México F3? ¿y luego?");
  });
});

describe("system prompt grounding rules", () => {
  for (const lang of ["es", "en"] as const) {
    const p = systemPrompt(lang, [], "console");
    it(`${lang}: separates F1 from the F-1 student visa and rejects nonexistent categories`, () => {
      expect(p).toMatch(lang === "es" ? /F1 NO es la visa de estudiante F-1/ : /F1 is NOT the F-1 student visa/);
      expect(p).toMatch(/F6/);
    });
    it(`${lang}: defines the MCS against the best model, not the deployed champion`, () => {
      expect(p).toMatch(lang === "es" ? /MEJOR modelo del hold-out/ : /BEST model in the hold-out/);
    });
    it(`${lang}: checks a priority date against the latest real cutoff first`, () => {
      expect(p).toMatch(lang === "es" ? /ya está al corriente/ : /already current/);
    });
    it(`${lang}: forbids describing a forecast chart that is not there`, () => {
      expect(p).toMatch(lang === "es" ? /SIN GRÁFICO NO HAY PRONÓSTICO/ : /NO CHART, NO FORECAST/);
    });
  }
});

// Second production battery (29-oct-2026): four answers still broke rules that
// were already in the prompt. Each case is the question that failed.
describe("topic reminders restated after the sources", () => {
  it("DFF winner: the MCS is read against the best model, never the champion", () => {
    const r = topicReminders("es", "¿Qué modelo gana en la tabla DFF y con qué MASE?");
    expect(r).toMatch(/MEJOR modelo del hold-out/);
    expect(r).toMatch(/NUNCA escribas que esos modelos «no se distinguen del campeón»/);
    expect(r).not.toMatch(/COBERTURA|ESTADOS/);
  });

  it("naïve question: does not open by denying the hold-out verdict", () => {
    const r = topicReminders("es", "¿Es cierto que el pronóstico ingenuo le gana a tus modelos?");
    expect(r).toMatch(/NAÏVE-1/);
    expect(r).toMatch(/NO abras con «No» ni «No exactamente»/);
    expect(r).toMatch(/^- MCS/m);
  });

  it("EN coverage: no invented hold-out coverage and the backfill is not 'not backtested'", () => {
    const r = topicReminders("en", "How reliable are your prediction intervals? Give me the coverage numbers.");
    expect(r).toMatch(/^REMINDERS FOR THIS QUESTION/);
    expect(r).toMatch(/leakage-free backfill/);
    expect(r).toMatch(/never say it is "not backtested"/);
  });

  it("Current: letters are not expanded (F is not 'Final')", () => {
    const r = topicReminders("es", "¿Qué significa que una categoría esté 'Current' o 'C' y el sistema lo predice?");
    expect(r).toMatch(/F es «se publicó una fecha específica», no «Final»/);
  });

  it("unrelated questions get no reminder block", () => {
    expect(topicReminders("es", "¿Qué es la retrogresión?")).toBe("");
    expect(systemPrompt("es", [], "console", "¿Qué es la retrogresión?")).not.toMatch(/RECORDATORIOS/);
  });

  it("the block closes the system prompt, after the sources", () => {
    const ctx = [{ n: 1, source: "Repo · Model card", title: "5. Evaluación", text: "MCS" }];
    const p = systemPrompt("es", ctx, "console", "¿Qué modelo gana en DFF?");
    expect(p.indexOf("RECORDATORIOS PARA ESTA PREGUNTA")).toBeGreaterThan(p.indexOf("FUENTES:"));
    expect(p.trimEnd().endsWith("ni que «son equivalentes al campeón»: el campeón desplegado sale del gate campeón-retador y el MCS no lo compara con él. Como receta desplegada de cada tabla nombra sólo la que las fuentes llamen campeón desplegado; que el gate retrospectivo declare «apta» otra receta no la vuelve la desplegada.")).toBe(true);
  });
});

describe("the handler sends the reminders for the user's question", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("the Anthropic body carries the MCS reminder for the DFF-winner question", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-never-used";
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (!String(url).startsWith("https://api.anthropic.com")) throw new Error(`unexpected fetch ${String(url)}`);
      bodies.push(String(init?.body));
      return new Response('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n',
        { status: 200, headers: { "content-type": "text/event-stream" } });
    }));
    const { default: handler } = await import("../netlify/functions/chat.mjs");
    const res = await handler(new Request("https://visapredictai.com/.netlify/functions/chat", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json" },
      body: JSON.stringify({ lang: "es", query: "¿Qué modelo gana en la tabla DFF y con qué MASE?", surface: "console" }),
    }));
    expect(res.status).toBe(200);
    await res.text();
    const { system } = JSON.parse(bodies[0]) as { system: string };
    expect(system).toMatch(/RECORDATORIOS PARA ESTA PREGUNTA[\s\S]*MEJOR modelo del hold-out/);
  });
});
