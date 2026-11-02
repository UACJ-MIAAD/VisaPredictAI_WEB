import { describe, it, expect } from "vitest";
import { makeBandWording, systemPrompt } from "../netlify/functions/chat.mjs";

// Thesis figure audit (29-oct-2026): a production answer called the 95 % forecast
// band a «banda de confianza». The bands are prediction intervals.

const run = (chunks: string[]) => {
  const w = makeBandWording();
  return chunks.map((c) => w.push(c)).join("") + w.flush();
};

describe("forecast band wording (makeBandWording)", () => {
  it("rewrites the Spanish and English band phrasing, keeping case and number", () => {
    expect(run(["con una banda de confianza al 95 % entre"])).toBe("con una banda de predicción al 95 % entre");
    expect(run(["Bandas de confianza amplias."])).toBe("Bandas de predicción amplias.");
    expect(run(["with a 95% confidence band of"])).toBe("with a 95% prediction band of");
    expect(run(["the confidence bands widen"])).toBe("the prediction bands widen");
  });

  it("recognizes a phrase split across stream deltas", () => {
    expect(run(["una ban", "da de conf", "ianza al 95 %"])).toBe("una banda de predicción al 95 %");
    expect(run(["a confid", "ence ba", "nd"])).toBe("a prediction band");
  });

  it("leaves legitimate confidence wording untouched and loses no text", () => {
    const text = "intervalo de confianza del 95 % [0.121, 0.123]; conjunto de confianza de modelos (MCS).";
    expect(run([text])).toBe(text);
    expect(run(text.split(""))).toBe(text);
    expect(run(["corto"])).toBe("corto");
  });
});

describe("system prompt interval rule", () => {
  for (const lang of ["es", "en"] as const) {
    it(`${lang}: names the bands prediction intervals, never confidence`, () => {
      const p = systemPrompt(lang, [], "console");
      expect(p).toMatch(lang === "es" ? /INTERVALOS: .*intervalos de PREDICCIÓN.*NUNCA «de confianza»/ : /INTERVALS: .*PREDICTION intervals.*NEVER "confidence"/);
    });
  }
});
