import {countryLabel} from "../data/panel-core.mjs";
import {forecastFor} from "../data/forecasts-core.mjs";
import {COUNTRY_ALIASES,queryEntities} from "./query-entities.mjs";
import {monthLabel} from "./synthetic-builders.mjs";

const MONTHS = ["enero january jan ene","febrero february feb","marzo march mar","abril april apr abr","mayo may","junio june jun","julio july jul","agosto august aug ago","septiembre september sept sep setiembre","octubre october oct","noviembre november nov","diciembre december dec dic"];
const monthMap = Object.fromEntries(MONTHS.flatMap((names,i)=>names.split(" ").map(n=>[n,i+1])));
const names = Object.keys(monthMap).sort((a,b)=>b.length-a.length).join("|");
export const PRIORITY_SOURCE={es:"Comparación de fechas (panel verificado)",en:"Date comparison (verified panel)"};
export function validPriorityDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t=Date.parse(s+"T00:00:00Z");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0,10)===s;
}
export function parsePriorityDate(q) {
  const found=[],fragments=[]; let ambiguous=false;
  const add=(y,m,d)=>found.push(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  for (const m of q.matchAll(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g)) {fragments.push(m[0]);add(m[1],+m[2],+m[3]);}
  for (const m of q.matchAll(new RegExp(`\\b(${names})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})\\b`,"gi"))) {fragments.push(m[0]);add(m[3],monthMap[m[1].toLowerCase()],+m[2]);}
  for (const m of q.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${names})\\.?\\s+(?:del?\\s+)?(\\d{4})\\b`,"gi"))) {fragments.push(m[0]);add(m[3],monthMap[m[2].toLowerCase()],+m[1]);}
  for (const m of q.matchAll(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/g)) {
    fragments.push(m[0]);
    const a=+m[1],b=+m[2];
    if(a<=12 && b<=12 && a!==b) ambiguous=true;
    else if(a>12) add(m[3],b,a); else add(m[3],a,b);
  }
  const dates=[...new Set(found)];
  if(ambiguous) return {date:null,issue:"ambiguous",fragments};
  if(dates.length>1) return {date:null,issue:"multiple",fragments};
  if(!dates.length) return {date:null,issue:"missing",fragments};
  return validPriorityDate(dates[0]) ? {date:dates[0],issue:null,fragments} : {date:null,issue:"invalid",fragments};
}
export function isPriorityQuery(q) {
  const marker=/\bpd\b|fecha\s+de\s+prioridad|priority\s+date|mi\s+prioridad/i.test(q);
  const dateLike=parsePriorityDate(q).issue!=="missing" || /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(q) || new RegExp(`\\b(?:${names})\\b[^?!.]{0,20}\\d{2,4}`,"i").test(q);
  const year=/\b(?:19|20|21)\d{2}\b/.test(q);
  const personal=/\bpd\b|mi\s+fecha\s+de\s+prioridad|my\s+priority\s+date|mi\s+prioridad/i.test(q);
  const concept=/^\s*[¿]?\s*(?:qu[eé]\s+(?:es|significa)|what\s+(?:is|does))\b/i.test(q);
  return personal && !(concept && !dateLike && !year) || marker && (dateLike || year) || /me toca|mi turno|my turn/i.test(q) && (dateLike || year);
}
const messages={
  date:{es:"Necesito una sola fecha de prioridad válida, con día, mes y año. Escríbela como AAAA-MM-DD para evitar ambigüedades.",en:"I need one valid priority date including day, month and year. Use YYYY-MM-DD to avoid ambiguity."},
  country:{es:"Indica un solo país o área de cargabilidad para comparar la misma serie.",en:"Specify one country or chargeability area so the comparison uses the same series."},
  category:{es:"Indica una sola categoría válida (y la subcategoría cuando corresponda).",en:"Specify one valid category (and its subcategory where applicable)."},
  table:{es:"Has indicado FAD y DFF. Elige una tabla para esta comparación.",en:"You named both FAD and DFF. Choose one table for this comparison."},
};
export function buildPriorityCheck(q,panel,store,lang) {
  if(!isPriorityQuery(q)) return null;
  const parsed=parsePriorityDate(q),e=queryEntities(q,panel);
  const countries=COUNTRY_ALIASES.filter(([re])=>re.test(q)).map(([,c])=>c);
  if(/\bROW\b/.test(q) && !countries.includes("all_chargeability")) countries.push("all_chargeability");
  const categoryTokens=[...q.toUpperCase().matchAll(/\b(?:EB|F)[ ._-]?\d(?:[ ._-]?[AB](?![A-Z]))?(?:_[A-Z]+)*/g)]
    .map(m=>m[0].replace(/[ ._-]/g,""));
  const fad=/\bFAD\b|final action|acci[oó]n final|\b(?:table|tabla)\s+A\b/i.test(q);
  const dff=/\bDFF\b|dates for filing|(?:fechas|tabla)\s+(?:de|para)\s+presentaci[oó]n|\b(?:table|tabla)\s+B\b/i.test(q);
  let issue=parsed.issue ? "date" : countries.length!==1 ? "country" : !e.category || new Set(categoryTokens).size!==1 ? "category"
    : fad && dff ? "table" : null;
  if(/\b(?:no soy|not|not from)\s+(?:mexic|india|chin|filip|philipp)/i.test(q)) issue="country";
  return priorityCheckSpec({priorityDate:parsed.date,country:e.country,category:e.category,table:dff?"DFF":"FAD"},panel,store,lang,issue);
}
// Verified comparison for STRUCTURED inputs (the agent tool passes them after
// reading the user's own words; the regex path above passes what it parsed).
// `issue` short-circuits to a request for the missing piece.
export function priorityCheckSpec({priorityDate,country,category,table},panel,store,lang,issue=null) {
  const en=lang==="en";
  const e={country,category};
  const parsed={date:priorityDate};
  const dff=table==="DFF";
  const spec={kind:"priorityCheck",title:en?"Your priority date vs the published cutoff":"Tu fecha frente al corte publicado",subtitle:"",result:"needs_input",statement:"",priorityDate:parsed.date,country:e.country,category:e.category,table:dff?"DFF":"FAD",bulletinMonth:panel.monthRange[1],cutoff:null,forecastNote:null,
    disclaimer:en?"This date comparison does not confirm an appointment, approval or the outcome of an individual case.":"Esta comparación de fechas no confirma una cita, aprobación ni la resolución de un trámite individual."};
  if(!issue && !validPriorityDate(priorityDate)) issue="date";
  if(!issue && !panel.countries.includes(country)) issue="country";
  if(!issue && !panel.categories.includes(category)) issue="category";
  if(issue) {spec.statement=messages[issue][en?"en":"es"];return spec;}
  spec.subtitle=`${countryLabel(e.country,lang)} · ${e.category} · ${spec.table} · ${monthLabel(spec.bulletinMonth,lang)}`;
  const row=panel.rows.find(r=>r.country===e.country && r.category===e.category && r.table===spec.table && r.bulletinMonth===spec.bulletinMonth);
  if(!row || !["F","C","U"].includes(row.status) || row.status==="F" && !validPriorityDate(row.priorityDate)) {
    spec.result="unknown";spec.statement=en?"The latest bulletin has no usable observation for this exact series. Your position cannot be determined.":"El último boletín no tiene una observación utilizable para esta serie exacta. No se puede determinar tu situación.";
  } else if(row.status==="C") {
    spec.result="current";spec.statement=en?"The selected table is CURRENT (C); it has no date cutoff to wait for.":"La tabla seleccionada está CURRENT (C); no tiene un corte de fecha que esperar.";
  } else if(row.status==="U") {
    spec.result="unavailable";spec.statement=en?"The selected table is UNAVAILABLE (U). This does not mean Current or a missing date.":"La tabla seleccionada está NO DISPONIBLE (U). Esto no significa Current ni dato faltante.";
  } else {
    spec.cutoff=row.priorityDate;
    spec.result=parsed.date<row.priorityDate?"before":parsed.date===row.priorityDate?"equal":"after";
    spec.statement=spec.result==="before" ? (en?"YOUR DATE IS ALREADY EARLIER THAN THE PUBLISHED CUTOFF.":"TU FECHA YA ES ANTERIOR AL CORTE PUBLICADO.")
      : spec.result==="equal" ? (en?"NOT YET: YOUR DATE EQUALS THE CUTOFF. It must be strictly earlier.":"TODAVÍA NO: TU FECHA ES IGUAL AL CORTE. Debe ser estrictamente anterior.")
      : (en?"NOT YET: THE PUBLISHED CUTOFF HAS NOT REACHED YOUR DATE.":"TODAVÍA NO: EL CORTE PUBLICADO AÚN NO ALCANZA TU FECHA.");
    if(spec.result!=="before") {
      const points=forecastFor(store??null,e.country,e.category,spec.table)?.filter(p=>p.date.slice(0,7)>spec.bulletinMonth);
      if(points?.length && row.daysSinceBase!=null) {
        const base=Date.parse(row.priorityDate+"T00:00:00Z")/86400000-row.daysSinceBase;
        const pd=Date.parse(parsed.date+"T00:00:00Z")/86400000-base;
        const hit=points.find(p=>p.days>pd),end=monthLabel(points.at(-1).date.slice(0,7),lang);
        spec.forecastNote=hit ? (en?`The model's central path first exceeds your date in ${monthLabel(hit.date.slice(0,7),lang)}. This is an uncertain projection, not a promised date or an appointment.`:`La trayectoria central del modelo supera tu fecha por primera vez en ${monthLabel(hit.date.slice(0,7),lang)}. Es una proyección incierta, no una fecha prometida ni una cita.`)
          : (en?`The central path does NOT exceed your date within the published horizon (through ${end}). There is no supported date estimate beyond that horizon.`:`La trayectoria central NO supera tu fecha dentro del horizonte publicado (hasta ${end}). No hay una fecha estimable respaldada más allá de ese horizonte.`);
      } else spec.forecastNote=en?"No usable production forecast is available for this series; a future date cannot be estimated.":"No hay un pronóstico de producción utilizable para esta serie; no se puede estimar una fecha futura.";
    }
  }
  if(spec.table==="DFF") spec.disclaimer+=(en?" This check uses Dates for Filing, not Final Action Dates.":" Esta comparación usa Dates for Filing, no Final Action Dates.");
  return spec;
}
export function priorityCheckSummary(s,lang) {
  const en=lang==="en";
  return `**${s.statement}**${s.priorityDate?`\n\n- ${en?"Your priority date":"Tu fecha de prioridad"}: ${s.priorityDate}`:""}${s.subtitle?`\n- ${en?"Series":"Serie"}: ${s.subtitle}`:""}${s.cutoff?`\n- ${en?"Published cutoff":"Corte publicado"}: ${s.cutoff}`:""}${s.forecastNote?`\n\n${s.forecastNote}`:""}\n\n${s.disclaimer}`;
}
