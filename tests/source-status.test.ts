/**
 * F2 · el estado de la fuente sale del feed canónico, o no se dice nada.
 *
 * El sitio prometía que el panel se actualizaba «automáticamente en cuanto aparece el boletín».
 * Dejó de ser cierto el 6 de agosto de 2026. Estas pruebas fijan las dos mitades del arreglo: la
 * promesa no vuelve, y el banner solo afirma lo que el pipeline registra. El corte publicado
 * todavía NO trae el artefacto, así que `absent` es un estado de primera clase y no se convierte
 * en un bloqueo inventado.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { tr } from "../lib/i18n";
import { SOURCE_STATUSES, deriveSourceStatus, parseSourceStatus } from "../lib/source-status";

const fixture = (nombre: string) =>
  readFileSync(resolve(__dirname, "fixtures", nombre), "utf8");

describe("absent is a first-class state, not an invented block", () => {
  it.each([null, undefined])("treats %s as absent", (valor) => {
    expect(deriveSourceStatus(valor)).toEqual({ kind: "absent" });
  });

  it("treats an empty body as absent", () => {
    expect(parseSourceStatus("")).toEqual({ kind: "absent" });
    expect(parseSourceStatus("   ")).toEqual({ kind: "absent" });
    expect(parseSourceStatus(null)).toEqual({ kind: "absent" });
  });

  it("never reports a block just because the record is missing", () => {
    // Es el estado del corte publicado HOY: el artefacto no viaja en él.
    const estado = deriveSourceStatus(undefined);
    expect(estado.kind).not.toBe("blocked");
    expect(estado.kind).toBe("absent");
  });
});

describe("the four recorded statuses come through with their evidence", () => {
  it("reads the blocked record the pipeline writes today", () => {
    const estado = parseSourceStatus(fixture("ingestion_state.blocked.json"));
    expect(estado).toEqual({
      kind: "blocked",
      since: "2026-09-02",
      reason: "HTTP 403 tras el WAF [https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html]",
      expectedMonth: "2026-09",
      panelVintage: "2026-09",
      missingMonths: [],
    });
  });

  it("reads a recovered record without leftovers from the blocked one", () => {
    const estado = parseSourceStatus(fixture("ingestion_state.ok.json"));
    expect(estado).toMatchObject({ kind: "ok", reason: null, since: "2026-10-02" });
  });

  it.each(["partial", "offline"] as const)("reads a %s record", (status) => {
    const estado = parseSourceStatus(fixture(`ingestion_state.${status}.json`));
    expect(estado.kind).toBe(status);
  });

  it("carries the months still pending when there are any", () => {
    const estado = parseSourceStatus(fixture("ingestion_state.partial.json"));
    expect(estado).toMatchObject({ missingMonths: ["2026-08", "2026-09"] });
  });

  it("accepts every status the canonical feed declares", () => {
    expect([...SOURCE_STATUSES]).toEqual(["ok", "blocked", "partial", "offline"]);
  });
});

describe("a present-but-bad record fails closed", () => {
  it("refuses unreadable JSON", () => {
    expect(() => parseSourceStatus("{no soy json")).toThrow(/ilegible/);
  });

  it.each([
    ["una lista", "[]"],
    ["un número", "3"],
    ["texto", '"blocked"'],
  ])("refuses %s where an object belongs", (_caso, cuerpo) => {
    expect(() => parseSourceStatus(cuerpo)).toThrow(/se esperaba un objeto/);
  });

  it("refuses a schema it does not know", () => {
    expect(() => parseSourceStatus(fixture("ingestion_state.schema2.json"))).toThrow(/esquema 2 no soportado/);
  });

  it("refuses an unknown status instead of passing it through", () => {
    expect(() => parseSourceStatus(fixture("ingestion_state.unknown.json"))).toThrow(/estado desconocido "degraded"/);
  });

  it.each([
    ["status_since", { status_since: "hoy" }],
    ["expected_month", { expected_month: "2026-9" }],
    ["panel_vintage", { panel_vintage: 202609 }],
  ])("refuses a malformed %s", (campo, parche) => {
    const base = JSON.parse(fixture("ingestion_state.blocked.json"));
    expect(() => deriveSourceStatus({ ...base, ...parche })).toThrow(new RegExp(campo));
  });

  it("refuses a reason that is neither text nor null", () => {
    const base = JSON.parse(fixture("ingestion_state.blocked.json"));
    expect(() => deriveSourceStatus({ ...base, reason: 403 })).toThrow(/'reason'/);
  });

  it.each([["no es lista", "2026-08"], ["trae basura", ["2026-8"]], ["trae números", [202608]]])(
    "refuses missing_months when it %s",
    (_caso, valor) => {
      const base = JSON.parse(fixture("ingestion_state.blocked.json"));
      expect(() => deriveSourceStatus({ ...base, missing_months: valor })).toThrow(/missing_months/);
    },
  );

  it("never degrades a bad record into absent", () => {
    // Degradar a `absent` sería ocultar la corrupción tras un silencio idéntico al normal.
    for (const malo of ['{"schema":2}', '{"schema":1,"status":"nope"}', "[]"]) {
      expect(() => parseSourceStatus(malo)).toThrow();
    }
  });
});

describe("the false promise is gone and does not come back", () => {
  it.each(["es", "en"] as const)("the %s bulletin subtitle no longer promises automatic updates", (lang) => {
    const texto = tr(lang, "blnSub");
    expect(texto).not.toMatch(/autom[aá]tica|automatically/i);
  });

  it("the source copy speaks about the source, not about the served data being broken", () => {
    // «sin ocultar un release fresh»: el bloqueo es de la INGESTA, no de lo que ya está publicado.
    expect(tr("es", "srcBlocked")).toMatch(/siguen siendo oficiales y verificados/);
    expect(tr("en", "srcBlocked")).toMatch(/still official and verified/);
  });

  it("no shipped source repeats the promise, not even the RAG's own corpus", () => {
    // La primera versión de F2 la quitó del diccionario y la dejó VIVA en content/source.html,
    // que es de donde el VisaBot construye su índice: el sitio callaba y el bot seguía
    // prometiendo. Se escanean las dos fuentes que llegan al usuario.
    const PROMESA = /actualiza este feed autom|updates this feed automatically/i;
    for (const ruta of ["lib/i18n.ts", "content/source.html"]) {
      expect(readFileSync(resolve(__dirname, "..", ruta), "utf8")).not.toMatch(PROMESA);
    }
  });

  it("every status has copy in both languages", () => {
    for (const clave of ["srcOk", "srcBlocked", "srcPartial", "srcOffline", "srcInvalid", "srcHeading"] as const) {
      expect(tr("es", clave).length).toBeGreaterThan(0);
      expect(tr("en", clave).length).toBeGreaterThan(0);
    }
  });
});
