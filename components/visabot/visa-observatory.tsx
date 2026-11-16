"use client";

import * as React from "react";
import {ArrowUpRight,MoveHorizontal} from "lucide-react";
import {countryLabel,type Panel} from "@/lib/data/visa-panel";
import {monthLabel} from "@/lib/visabot/analytics";

type Props={panel:Panel|null;country:string;category:string;table:string;lang:"es"|"en";onCountry:(country:string)=>void;onExplore:()=>void};
const SHORT:Record<string,string>={mexico:"MX",india:"IN",china:"CN",philippines:"PH",all_chargeability:"RoW"};
const stamp=(m:string)=>Date.parse(`${m}-01T00:00:00Z`);

/** A real historical series, drawn as an instrument rather than decoration.
 * Every selectable point is an observation; C/U/missing dates break the path. */
export function VisaObservatory({panel,country,category,table,lang,onCountry,onExplore}:Props){
  const id="vb-"+React.useId().replace(/[^a-z0-9_-]/gi,"");
  const [inspected,setInspected]=React.useState<number|null>(null);
  React.useEffect(()=>setInspected(null),[country,category,table]);
  const rows=React.useMemo(()=>panel?.rows.filter(r=>r.country===country&&r.category===category&&r.table===table)
    .sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth)).slice(-36)??[],[panel,country,category,table]);
  const at=inspected===null?rows.length-1:Math.min(inspected,rows.length-1);
  const selected=rows[at];
  const en=lang==="en";
  const display=selected?.status==="C"?"Current":selected?.status==="U"?(en?"Unavailable":"No disponible")
    :selected?.status==="F"&&selected.priorityDate?selected.priorityDate:(en?"No observation":"Sin observación");
  const values=rows.map(r=>r.status==="F"&&r.priorityDate?Date.parse(r.priorityDate+"T00:00:00Z"):NaN);
  const finite=values.filter(Number.isFinite);
  const min=finite.length?Math.min(...finite):0,max=finite.length?Math.max(...finite):1;
  const pad=Math.max((max-min)*0.18,60*86400000);
  const low=min-pad,high=max+pad;
  const first=rows[0]?.bulletinMonth,last=rows.at(-1)?.bulletinMonth;
  const x=(i:number)=>32+(rows.length<2?0:(stamp(rows[i].bulletinMonth)-stamp(first!))/Math.max(1,stamp(last!)-stamp(first!)))*416;
  const y=(v:number)=>190-(v-low)/(high-low)*142;
  const segments:string[]=[];let part="";
  values.forEach((v,i)=>{if(Number.isFinite(v))part+=`${part?" L":"M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`;else if(part){segments.push(part);part="";}});
  if(part)segments.push(part);
  const tick=(v:number)=>new Intl.DateTimeFormat(en?"en-US":"es-MX",{timeZone:"UTC",...(max-min>365*86400000?{year:"numeric" as const}:{month:"short" as const,year:"numeric" as const})}).format(new Date(v));
  return <figure className="vb-observatory" aria-label={en?"Interactive bulletin history":"Historial interactivo del boletín"}>
    <div className="vb-observatory-orbits" aria-hidden="true"><i/><i/><i/><span/></div>
    <figcaption className="vb-observatory-head">
      <span className="vb-instrument-label"><span aria-hidden="true"/>{en?"THE DATE OBSERVATORY":"OBSERVATORIO DE FECHAS"}</span>
      <span className="vb-instrument-code">{category} / {table}</span>
    </figcaption>
    <div className="vb-observatory-readout" aria-live="polite" aria-atomic="true">
      <span>{countryLabel(country,lang)} <span aria-hidden="true">·</span> {selected?monthLabel(selected.bulletinMonth,lang):(en?"Loading the panel":"Cargando el panel")}</span>
      <strong data-vb-observation>{selected?display:"—"}</strong>
      <span className="vb-readout-caption">{en?"Published cutoff · historical observation":"Corte publicado · observación histórica"}</span>
    </div>
    <div className="vb-observatory-plot">
      <svg viewBox="0 0 480 236" role="img" aria-label={en?`Historical cutoffs for ${countryLabel(country,lang)} ${category} ${table}`:`Cortes históricos de ${countryLabel(country,lang)} ${category} ${table}`}>
        <defs>
          <linearGradient id={`${id}-line`} x1="0" x2="1"><stop stopColor="#67c6ff"/><stop offset="1" stopColor="#c9edff"/></linearGradient>
          <linearGradient id={`${id}-area`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#55b9ff" stopOpacity=".24"/><stop offset="1" stopColor="#55b9ff" stopOpacity="0"/></linearGradient>
          <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        {[0,1,2].map(i=><g key={i} className="vb-instrument-grid"><path d={`M32 ${48+i*71}H448`}/>{finite.length>0&&<text x="32" y={40+i*71}>{tick(high-(high-low)*i/2)}</text>}</g>)}
        {segments.map((d,i)=><React.Fragment key={i}>
          <path d={d+` L${Number(d.match(/([\d.]+),[\d.]+$/)?.[1]??32)},190 L${Number(d.match(/^M([\d.]+)/)?.[1]??32)},190 Z`} fill={`url(#${id}-area)`}/>
          <path d={d} className="vb-instrument-glow" stroke={`url(#${id}-line)`} filter={`url(#${id}-glow)`}/>
          <path d={d} className="vb-instrument-line" pathLength="1" stroke={`url(#${id}-line)`}/>
        </React.Fragment>)}
        {selected&&<g className="vb-instrument-cursor"><path d={`M${x(at)} 30V198`}/>{Number.isFinite(values[at])&&<><circle cx={x(at)} cy={y(values[at])} r="13" className="vb-instrument-halo"/><circle cx={x(at)} cy={y(values[at])} r="4.5" className="vb-instrument-point"/></>}</g>}
        <g className="vb-instrument-axis"><text x="32" y="224">{first?monthLabel(first,lang):"—"}</text><text x="448" y="224" textAnchor="end">{last?monthLabel(last,lang):"—"}</text></g>
        {rows.length===0&&<text x="240" y="125" textAnchor="middle" className="vb-instrument-empty">{en?"Preparing the historical series":"Preparando la serie histórica"}</text>}
      </svg>
    </div>
    <div className="vb-observatory-scrubber">
      <MoveHorizontal size={14} aria-hidden="true"/>
      <input type="range" min="0" max={Math.max(0,rows.length-1)} value={Math.max(0,at)} disabled={rows.length<2}
        onChange={e=>setInspected(Number(e.target.value))} aria-label={en?"Explore bulletin month":"Recorre los meses del boletín"}
        aria-valuetext={selected?`${monthLabel(selected.bulletinMonth,lang)}: ${display}`:undefined}/>
      <span>{en?"EXPLORE":"RECORRE"}</span>
    </div>
    <div className="vb-observatory-footer">
      <div className="vb-country-switch" role="group" aria-label={en?"Choose a chargeability area":"Elegir área de cargabilidad"}>
        {(panel?.countries??[]).map(c=><button key={c} type="button" aria-label={`${countryLabel(c,lang)}${SHORT[c]?` (${SHORT[c]})`:""}`} aria-pressed={country===c} onClick={()=>{setInspected(null);onCountry(c);}}>{SHORT[c]??countryLabel(c,lang)}</button>)}
      </div>
      <button className="vb-observatory-explore" onClick={onExplore} disabled={!panel} aria-label={en?"View forecast for this series":"Ver pronóstico de esta serie"}><span className="vb-observatory-explore-label">{en?"View forecast":"Ver pronóstico"}</span><ArrowUpRight size={18} aria-hidden="true"/></button>
    </div>
  </figure>;
}
