import { describe, it, expect } from "vitest";
import { buildPanel } from "@/lib/data/panel-core";
import { detectEntities, parseMonth } from "@/lib/visabot/analytics";
import { PANEL_CSV } from "./fixtures";

const panel = buildPanel(PANEL_CSV);

describe("detectEntities", () => {
  it("detects country + category + table from Spanish text", () => {
    const e = detectEntities("¿Cómo va México F2A en la tabla de acción final?", panel);
    expect(e).toEqual({ country: "mexico", category: "F2A", table: "FAD", block: "familia" });
  });

  it("detects entities from English text", () => {
    const e = detectEntities("When will Philippines F1 move in the Dates for Filing table?", panel);
    expect(e).toEqual({ country: "philippines", category: "F1", table: "DFF", block: "familia" });
  });

  it("prefers the longest category code: EB5_RURAL wins over EB5", () => {
    const e = detectEntities("China EB5 rural final action", panel);
    expect(e.category).toBe("EB5_RURAL");
    expect(e.country).toBe("china");
    expect(e.table).toBe("FAD");
    expect(e.block).toBe("empleo");
  });

  it("still matches plain EB5 when no subcategory is named", () => {
    expect(detectEntities("india eb5", panel).category).toBe("EB5");
  });

  it("maps 'resto del mundo' to the residual chargeability area", () => {
    expect(detectEntities("resto del mundo", panel).country).toBe("all_chargeability");
  });

  it("returns all nulls when nothing matches", () => {
    expect(detectEntities("hola, ¿qué puedes hacer?", panel)).toEqual({
      country: null, category: null, table: null, block: null,
    });
  });

  it("still detects the code when it precedes a word starting with A or B (regression)", () => {
    // the code normalizer must not absorb the next word's first letter
    // (fixture categories: F1, F2A, EB2, EB5 — use those before A/B words)
    expect(detectEntities("F1 backlog for Mexico", panel).category).toBe("F1");
    expect(detectEntities("when does F1 advance", panel).category).toBe("F1");
    expect(detectEntities("india EB2 based jobs", panel).category).toBe("EB2");
    expect(detectEntities("EB2 by month", panel).category).toBe("EB2");
  });
});

describe("parseMonth", () => {
  it("parses a Spanish month name + year", () => {
    expect(parseMonth("boletín de julio 2024", panel)).toBe("2024-07");
  });

  it("parses an English month name + year", () => {
    expect(parseMonth("show me March 2020", panel)).toBe("2020-03");
  });

  it("parses an abbreviated month + year", () => {
    expect(parseMonth("jul 2010", panel)).toBe("2010-07");
  });

  it("parses ISO YYYY-MM and numeric M/YYYY forms", () => {
    expect(parseMonth("2024-07 por favor", panel)).toBe("2024-07");
    expect(parseMonth("tabla de 3/2018", panel)).toBe("2018-03");
  });

  it("resolves a bare year to its latest month in the panel", () => {
    expect(parseMonth("cómo cerró 2024", panel)).toBe("2024-09");
  });

  it("returns null for months absent from the panel, and for garbage", () => {
    expect(parseMonth("julio 2030", panel)).toBeNull();
    expect(parseMonth("no month here", panel)).toBeNull();
  });

  it("resolves relative 'latest / último boletín' to the newest month", () => {
    expect(parseMonth("muéstrame el último boletín", panel)).toBe("2024-09");
    expect(parseMonth("the latest bulletin", panel)).toBe("2024-09");
  });

  it("resolves a quarter to the last available month of that quarter", () => {
    expect(parseMonth("Q3 2024", panel)).toBe("2024-09");
    expect(parseMonth("tercer trimestre de 2024", panel)).toBe("2024-09");
  });
});
