// Schema v1 of vp_data.ingestion_state. Used by both the build loader and UI.
export const INGESTION_PATH = "reports/governance/ingestion_state.json";
const KEYS = ["schema", "status", "panel_vintage", "expected_month", "missing_months", "status_since", "last_success_date", "n_index_links", "failed_links", "reason"];
const STATUSES = ["ok", "blocked", "partial", "offline"];
const month = (v) => typeof v === "string" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(v);
const day = (v) => typeof v === "string" && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v)
  && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** @param {unknown} raw @returns {string[]} */
export function ingestionProblems(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return ["se esperaba un objeto"];
  const s = /** @type {Record<string, unknown>} */ (raw);
  const problems = [];
  const missing = KEYS.filter((k) => !(k in s));
  const extra = Object.keys(s).filter((k) => !KEYS.includes(k));
  if (missing.length || extra.length) problems.push(`schema cerrado: faltan ${missing.join(",")}; sobran ${extra.join(",")}`);
  if (s.schema !== 1) problems.push(`esquema ${JSON.stringify(s.schema)} no soportado (se espera 1)`);
  if (typeof s.status !== "string" || !STATUSES.includes(s.status)) problems.push(`estado desconocido ${JSON.stringify(s.status)}`);
  for (const k of ["expected_month", "panel_vintage"]) {
    if (!(k === "panel_vintage" && s[k] === null) && !month(s[k])) problems.push(`'${k}' no es un mes YYYY-MM válido`);
  }
  if (!day(s.status_since)) problems.push("'status_since' no es una fecha válida");
  if (s.last_success_date !== null && !day(s.last_success_date)) problems.push("'last_success_date' no es una fecha válida");
  if (!Array.isArray(s.missing_months) || !s.missing_months.every(month)) problems.push("'missing_months' debe ser una lista de meses válidos");
  if (s.n_index_links !== null && (!Number.isSafeInteger(s.n_index_links) || Number(s.n_index_links) < 0)) problems.push("'n_index_links' debe ser un entero no negativo o nulo");
  if (!Array.isArray(s.failed_links) || !s.failed_links.every((v) => typeof v === "string")) problems.push("'failed_links' debe ser una lista de texto");
  if (typeof s.reason !== "string") problems.push("'reason' debe ser texto");
  return problems;
}

/** Parse valid JSON once; also reject duplicate top-level keys (JSON.parse alone loses them). */
export function parseIngestionRecord(body) {
  if (typeof body !== "string" || body.length > 131072) throw new Error("ingestion_state: cuerpo ausente o demasiado grande");
  let raw;
  try { raw = JSON.parse(body); } catch { throw new Error("ingestion_state: JSON ilegible"); }
  const seen = new Set();
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"') {
      const start = i++;
      for (; i < body.length; i++) {
        if (body[i] === "\\") { i++; continue; }
        if (body[i] === '"') break;
      }
      if (depth === 1 && body.slice(i + 1).trimStart().startsWith(":")) {
        const key = JSON.parse(body.slice(start, i + 1));
        if (seen.has(key)) throw new Error(`ingestion_state: clave duplicada '${key}'`);
        seen.add(key);
      }
    } else if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") depth--;
  }
  const problems = ingestionProblems(raw);
  if (problems.length) throw new Error(`ingestion_state: ${problems.join("; ")}`);
  return raw;
}
