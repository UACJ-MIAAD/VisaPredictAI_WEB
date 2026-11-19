import { describe, it, expect } from "vitest";
import { makeBandWording } from "../netlify/functions/chat.mjs";
import { agentSystem } from "../lib/visabot/agent.mjs";
// The agent's system prompt (static rules + per-release catalog) as one string.
const agentPrompt = (lang: "es" | "en", horizon = 12) =>
  agentSystem({ lang, surface: "console", catalog: { firstMonth: "2001-12", latestMonth: "2026-11", categories: ["F1", "F2A"], horizon } })
    .map((b: { text: string }) => b.text).join("\n");


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

describe("agent prompt interval rule", () => {
  for (const lang of ["es", "en"] as const) {
    it(`${lang}: names the bands prediction intervals, never confidence`, () => {
      expect(agentPrompt(lang)).toMatch(/80% and 95% prediction intervals: they bound the future cutoff\. Never call them confidence intervals\./);
    });
  }
});
