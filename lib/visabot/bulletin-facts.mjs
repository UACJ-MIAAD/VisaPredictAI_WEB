// Text of the "latest bulletin" RAG fact, built from the live bulletins feed.
// Demo rehearsal (15-nov-2026): the old text listed the first 12 advances in
// feed (alphabetical) order with no magnitude, so the model called them
// "highlights" and once relabelled "F4 DFF (01NOV12)" as EB4. Now the lists are
// ordered by magnitude, every item carries its change in days, and the pilot
// country gets its own line.

const PILOT = "mexico";
const TOP = 12;

const byMagnitude = (xs) =>
  [...xs].sort((a, b) => Math.abs(b.delta_days) - Math.abs(a.delta_days) ||
    `${a.country}${a.category}${a.table}`.localeCompare(`${b.country}${b.category}${b.table}`));

export function bulletinFactText(rows, monthLabel, lang, countryName) {
  const es = lang === "es";
  const adv = byMagnitude(rows.filter((x) => (x.delta_days ?? 0) > 0));
  const ret = byMagnitude(rows.filter((x) => (x.delta_days ?? 0) < 0));
  const item = (x) => {
    const d = x.delta_days > 0 ? `+${x.delta_days}` : `${x.delta_days}`;
    return `${countryName(x.country)} ${x.category} ${x.table}: ${x.raw_value || "—"} (${d} ${es ? "días" : "days"})`;
  };
  const list = (xs) => (xs.length ? xs.slice(0, TOP).map(item).join("; ") : (es ? "ninguno" : "none"));
  const pilot = adv.filter((x) => x.country === PILOT).concat(ret.filter((x) => x.country === PILOT));
  const unchanged = rows.length - adv.length - ret.length;
  return es
    ? `Boletín más reciente del Visa Bulletin: ${monthLabel}. Se publicaron ${rows.length} series. Avanzaron ${adv.length}, retrocedieron ${ret.length} y ${unchanged} no se movieron o no tienen fecha. Mayores avances (ordenados por días): ${list(adv)}. Mayores retrocesos: ${list(ret)}. Movimientos de ${countryName(PILOT)}: ${list(pilot)}. Estas son fechas oficiales publicadas, no predicciones del modelo.`
    : `Most recent U.S. Visa Bulletin: ${monthLabel}. ${rows.length} series published. ${adv.length} advanced, ${ret.length} retrogressed and ${unchanged} did not move or have no date. Largest advances (ordered by days): ${list(adv)}. Largest retrogressions: ${list(ret)}. Movements for ${countryName(PILOT)}: ${list(pilot)}. These are official published dates, not model predictions.`;
}
