/**
 * F2 · Estado de la FUENTE, derivado del feed canónico de ingesta (D3).
 *
 * El sitio prometía actualizarse «automáticamente en cuanto aparece el boletín». Dejó de ser
 * cierto el 6 de agosto de 2026, cuando travel.state.gov quedó tras un WAF y los dos boletines
 * siguientes entraron a mano. La promesa se retira, y en su lugar el sitio dice lo que el
 * pipeline REGISTRA, nunca lo que un texto sugiera ni un valor tecleado.
 *
 * La fuente es `reports/governance/ingestion_state.json` (esquema v1, cerrado). Todavía no viaja
 * en el corte publicado: por eso `absent` es un estado de primera clase y NO se inventa un bloqueo
 * cuando el artefacto falta. Lo que sí falla cerrado es un artefacto PRESENTE y malo: ilegible,
 * de otro esquema, con un estado desconocido o con campos del tipo equivocado.
 */

export const SOURCE_STATUSES = ["ok", "blocked", "partial", "offline"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export type SourceState =
  | { kind: "absent" }
  | {
      kind: SourceStatus;
      since: string;
      reason: string | null;
      expectedMonth: string;
      panelVintage: string;
      missingMonths: string[];
    };

const MES = /^\d{4}-\d{2}$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * `null`/`undefined` = el corte no publica el artefacto todavía → `absent`. Cualquier otra cosa
 * que no sea un feed v1 válido lanza: un banner tranquilizador construido sobre datos corruptos
 * es peor que ninguno.
 */
export function deriveSourceStatus(raw: unknown): SourceState {
  if (raw === null || raw === undefined) return { kind: "absent" };
  if (!esObjeto(raw)) throw new Error(`ingestion_state: se esperaba un objeto, llegó ${Array.isArray(raw) ? "una lista" : typeof raw}`);
  if (raw.schema !== 1) throw new Error(`ingestion_state: esquema ${JSON.stringify(raw.schema)} no soportado (se espera 1)`);

  const status = raw.status;
  if (typeof status !== "string" || !(SOURCE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`ingestion_state: estado desconocido ${JSON.stringify(status)} (válidos: ${SOURCE_STATUSES.join(", ")})`);
  }
  for (const [campo, patron] of [
    ["status_since", DIA],
    ["expected_month", MES],
    ["panel_vintage", MES],
  ] as const) {
    const valor = raw[campo];
    if (typeof valor !== "string" || !patron.test(valor)) {
      throw new Error(`ingestion_state: '${campo}' debería ser una fecha ${patron === DIA ? "YYYY-MM-DD" : "YYYY-MM"}, llegó ${JSON.stringify(valor)}`);
    }
  }
  const reason = raw.reason;
  if (reason !== null && typeof reason !== "string") {
    throw new Error(`ingestion_state: 'reason' debería ser texto o nulo, llegó ${JSON.stringify(reason)}`);
  }
  const missing = raw.missing_months;
  if (!Array.isArray(missing) || missing.some((m) => typeof m !== "string" || !MES.test(m))) {
    throw new Error(`ingestion_state: 'missing_months' debería ser una lista de meses YYYY-MM, llegó ${JSON.stringify(missing)}`);
  }
  return {
    kind: status as SourceStatus,
    since: raw.status_since as string,
    reason: (reason ?? null) as string | null,
    expectedMonth: raw.expected_month as string,
    panelVintage: raw.panel_vintage as string,
    missingMonths: missing as string[],
  };
}

/** Texto crudo → estado. Un cuerpo ilegible falla cerrado; el vacío se trata como ausencia. */
export function parseSourceStatus(body: string | null | undefined): SourceState {
  if (body === null || body === undefined || body.trim() === "") return { kind: "absent" };
  let dato: unknown;
  try {
    dato = JSON.parse(body);
  } catch (e) {
    throw new Error(`ingestion_state: JSON ilegible (${(e as Error).message})`);
  }
  return deriveSourceStatus(dato);
}
