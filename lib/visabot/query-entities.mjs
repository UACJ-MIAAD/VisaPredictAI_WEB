// Shared query identifiers: the browser and verified server checks must select
// exactly the same series. No dates or figures are accepted as source facts.
export const COUNTRY_ALIASES = [
  [/m[eé]xico|mexican|mexico/i, "mexico"],
  [/\bindia\b|\bindi[oa]\b/i, "india"],
  [/\bchina\b|\bchin[oa]\b/i, "china"],
  [/filipin|philippin/i, "philippines"],
  [/all charge?ability|resto del mundo|todos los pa[ií]ses/i, "all_chargeability"],
];
export function queryEntities(q, panel) {
  const country = COUNTRY_ALIASES.find(([re]) => re.test(q))?.[1] ?? (/\bROW\b/.test(q) ? "all_chargeability" : null);
  const up = ` ${q.toUpperCase().replace(/\b(EB|F)[ ._-]?(\d)(?:[ ._-]?([AB])(?![A-Z]))?/g, (_m,p,d,x)=>p+d+(x||""))} `;
  const cats = [...panel.categories].sort((a,b)=>b.length-a.length);
  let category = null;
  for (const c of cats) {
    const pat = c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/_/g,"[ _-]?");
    if (new RegExp(`(?<![A-Z0-9])${pat}(?![A-Z0-9])`).test(up)) { category=c; break; }
  }
  const table = /\bDFF\b|DATES FOR FILING|PRESENTACI|\b(?:TABLE|TABLA)\s+B\b/i.test(q) ? "DFF"
    : /\bFAD\b|FINAL ACTION|ACCI[OÓ]N FINAL|\b(?:TABLE|TABLA)\s+A\b/i.test(q) ? "FAD" : null;
  const block = /\bempleo\b|employment|\bEB\b/i.test(q) || /\bEB[1-5]/i.test(q) ? "empleo"
    : /\bfamilia\b|family|\bF[1-4]/i.test(q) ? "familia" : null;
  return {country,category,table,block};
}
