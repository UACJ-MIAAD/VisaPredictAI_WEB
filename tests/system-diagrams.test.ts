import { describe, expect, it } from "vitest";
import catalog from "./fixtures/database-catalog.json";
import { DATABASE_ENTITIES, DATABASE_RELATIONS, DATABASE_VIEWS } from "@/lib/database-diagram";
import { COMPONENT_FLOWS, DATABASE_SOURCES, SYSTEM_FLOW } from "@/lib/system-diagrams";
import { routeByPath } from "@/lib/site-map";

describe("system architecture", () => {
  for (const flow of [SYSTEM_FLOW, ...COMPONENT_FLOWS]) {
    it(`${flow.id}: every connection has endpoints and every step is reachable`, () => {
      const ids = flow.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
      const reached = new Set([ids[0]]);
      for (const e of flow.edges) {
        expect(ids).toContain(e.from);
        expect(ids).toContain(e.to);
        expect(e.from).not.toBe(e.to);
      }
      for (let i = 0; i < ids.length; i++) {
        for (const e of flow.edges) if (reached.has(e.from)) reached.add(e.to);
      }
      expect([...reached].sort()).toEqual([...ids].sort());
    });
    it(`${flow.id}: both locales and published code references are present`, () => {
      for (const text of [flow.title, flow.description, flow.boundary, ...flow.nodes.flatMap((n) => [n.title, n.detail])]) {
        expect(text.es.trim()).not.toBe("");
        expect(text.en.trim()).not.toBe("");
      }
      expect(flow.sources.length).toBeGreaterThan(0);
      for (const source of flow.sources) expect(source.href).toMatch(/^https:\/\/github\.com\/UACJ-MIAAD\/VisaPredictAI(?:_WEB)?\/blob\/[a-f0-9]{40}\//);
    });
  }
  it("the overview covers every independent component", () => {
    expect([...new Set(SYSTEM_FLOW.nodes.map((n) => n.component))].sort()).toEqual(COMPONENT_FLOWS.map((f) => f.id).sort());
  });
  it("manual ingestion branches only when the source is blocked", () => {
    const ingestion = COMPONENT_FLOWS.find((f) => f.id === "ingesta")!;
    expect(ingestion.edges.filter((e) => e.from === "acceso").map((e) => e.to).sort()).toEqual(["archivo", "manual"]);
  });
  it("engineering navigation exposes both new anchors", () => {
    expect(routeByPath("/ingenieria").sections.slice(0, 2).map((s) => s.id)).toEqual(["sistema", "base-datos"]);
  });
});

describe("database diagram versus a DuckDB catalog built from the published DDL", () => {
  it("includes every table, every column in catalog order and exact primary keys", () => {
    expect(DATABASE_ENTITIES.map((e) => e.id).sort()).toEqual(Object.keys(catalog.tables).sort());
    for (const e of DATABASE_ENTITIES) {
      expect(e.columns, e.id).toEqual(catalog.tables[e.id as keyof typeof catalog.tables]);
      expect(e.primaryKey, e.id).toEqual(catalog.primaryKeys[e.id as keyof typeof catalog.primaryKeys]);
    }
  });
  it("draws exactly the foreign keys declared in SQL", () => {
    const key = (r: { from: string; column: string; to: string; target: string }) => `${r.from}.${r.column}->${r.to}.${r.target}`;
    expect(DATABASE_RELATIONS.filter((r) => r.kind === "foreign-key").map(key).sort()).toEqual(catalog.foreignKeys.map(key).sort());
  });
  it("keeps code-checked run lineage and by-value source joins distinct from SQL FKs", () => {
    expect(DATABASE_RELATIONS.filter((r) => r.kind === "asserted").map((r) => r.from).sort()).toEqual(["fact_dv_rank", "fact_priority"]);
    expect(DATABASE_RELATIONS.filter((r) => r.kind === "by-value")).toEqual([{ from: "source_artifact", column: "vintage", to: "dim_date", target: "bulletin_date", kind: "by-value" }]);
    expect(DATABASE_RELATIONS.some((r) => r.column === "parent_code")).toBe(false);
  });
  it("all relationship fields exist and DV has no FAD/DFF key", () => {
    for (const r of DATABASE_RELATIONS) {
      expect(DATABASE_ENTITIES.find((e) => e.id === r.from)?.columns).toContain(r.column);
      expect(DATABASE_ENTITIES.find((e) => e.id === r.to)?.columns).toContain(r.target);
    }
    expect(DATABASE_ENTITIES.find((e) => e.id === "fact_dv_rank")?.columns).not.toContain("table_id");
  });
  it("lists the actual published views and pins the schema sources", () => {
    expect([...DATABASE_VIEWS].sort()).toEqual(catalog.views);
    for (const path of Object.keys(catalog.sourceHashes)) expect(DATABASE_SOURCES.some((s) => s.href.endsWith(`${catalog.sourceCommit}/${path}`))).toBe(true);
  });
});
