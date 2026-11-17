"use client";

import * as React from "react";
import {ArrowUpRight,MoveHorizontal,Maximize2,RectangleHorizontal,X} from "lucide-react";
import {countryLabel,type Panel} from "@/lib/data/visa-panel";
import {monthLabel} from "@/lib/visabot/analytics";
import {useFocusTrap} from "@/lib/use-focus-trap";
import {lockBodyScroll} from "@/lib/body-scroll-lock";

type Props={panel:Panel|null;panelError:boolean;country:string;category:string;table:string;lang:"es"|"en";onCountry:(country:string)=>void;onCategory:(category:string)=>void;onTable:(table:string)=>void;wide:boolean;onWide:()=>void;onExpandedChange:(open:boolean)=>void;onExplore:()=>void};
const SHORT:Record<string,string>={mexico:"MX",india:"IN",china:"CN",philippines:"PH",all_chargeability:"RoW"};
const stamp=(m:string)=>Date.parse(`${m}-01T00:00:00Z`);
const monthNumber=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7));

/** A real historical series, drawn as an instrument rather than decoration.
 * Every selectable point is an observation; C/U/missing dates break the path. */
export function VisaObservatory({panel,panelError,country,category,table,lang,onCountry,onCategory,onTable,wide,onWide,onExpandedChange,onExplore}:Props){
  // The page owns one instrument. Keep paint IDs identical in the static export
  // and hydrated tree even when their surrounding React tree differs.
  const [expanded,setExpanded]=React.useState(false);
  const [largeViewport,setLargeViewport]=React.useState(false);
  React.useEffect(()=>{
    const query=window.matchMedia("(min-width:740px)");
    const update=()=>setLargeViewport(query.matches);update();
    query.addEventListener("change",update);return ()=>query.removeEventListener("change",update);
  },[]);
  const dialog=useFocusTrap<HTMLDialogElement>(expanded);
  const expandButton=React.useRef<HTMLButtonElement>(null);
  React.useEffect(()=>{
    if(!expanded)return;
    dialog.current?.showModal();
    const releaseScroll=lockBodyScroll();
    return ()=>{releaseScroll();onExpandedChange(false);};
  },[expanded,onExpandedChange,dialog]);
  const [inspected,setInspected]=React.useState<number|null>(null);
  const [fromMonth,setFromMonth]=React.useState("");
  React.useEffect(()=>{setInspected(null);setFromMonth("");},[country,category,table]);
  const series=React.useMemo(()=>panel?.rows.filter(r=>r.country===country&&r.category===category&&r.table===table)
    .sort((a,b)=>a.bulletinMonth.localeCompare(b.bulletinMonth))??[],[panel,country,category,table]);
  // A series with different coverage must never display "All history" while
  // silently retaining a start month that is absent from its options.
  const validFromMonth=fromMonth&&series.some(r=>r.bulletinMonth===fromMonth)?fromMonth:"";
  const fromYear=validFromMonth.slice(0,4);
  const years=[...new Set(series.map(r=>r.bulletinMonth.slice(0,4)))];
  const yearMonths=series.filter(r=>r.bulletinMonth.startsWith(`${fromYear}-`)).map(r=>r.bulletinMonth.slice(5));
  const changeStart=(value:string)=>{setFromMonth(value);setInspected(null);};
  const changeYear=(year:string)=>{
    const available=series.filter(r=>r.bulletinMonth.startsWith(`${year}-`));
    changeStart(year?(available.find(r=>r.bulletinMonth.slice(5)===validFromMonth.slice(5))??available[0])?.bulletinMonth??"":"");
  };
  const rows=React.useMemo(()=>validFromMonth?series.filter(r=>r.bulletinMonth>=validFromMonth):series,[series,validFromMonth]);
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
  const y=(v:number)=>190-(v-low)/(high-low)*142;
  const tick=(v:number)=>new Intl.DateTimeFormat(en?"en-US":"es-MX",{timeZone:"UTC",...(max-min>3*365*86400000?{year:"numeric" as const}:{month:"short" as const,year:"numeric" as const})}).format(new Date(v));
  const instrument=(full:boolean)=>{
    const id=`vb-observatory-${full?"expanded":"inline"}-${country}-${category}-${table}`;
    const chartWidth=full&&largeViewport?960:480;
    const right=chartWidth-32;
    const x=(i:number)=>32+(rows.length<2?0:(stamp(rows[i].bulletinMonth)-stamp(first!))/Math.max(1,stamp(last!)-stamp(first!)))*(chartWidth-64);
    const segments:string[]=[],isolated:number[]=[];let run:number[]=[];
    const flush=()=>{if(run.length===1)isolated.push(run[0]);else if(run.length>1)segments.push(run.map((i,n)=>`${n?"L":"M"}${x(i).toFixed(2)},${y(values[i]).toFixed(2)}`).join(" "));run=[];};
    values.forEach((v,i)=>{if(i&&monthNumber(rows[i].bulletinMonth)-monthNumber(rows[i-1].bulletinMonth)!==1)flush();if(Number.isFinite(v))run.push(i);else flush();});flush();
    return <figure className="vb-observatory" data-vb-full={full} aria-label={en?"Interactive bulletin history":"Historial interactivo del boletín"}>
    <div className="vb-observatory-orbits" aria-hidden="true"><i/><i/><i/><span/></div>
    <figcaption className="vb-observatory-head">
      <span className="vb-instrument-label"><span aria-hidden="true"/>{en?"THE DATE OBSERVATORY":"OBSERVATORIO DE FECHAS"}</span>
      <span className="vb-instrument-code">{category} / {table}</span>
    </figcaption>
    <div className="vb-observatory-controls">
      <label><span>{en?"Category":"Categoría"}</span><select aria-label={en?"Observatory category":"Categoría del observatorio"} value={category} disabled={!panel} onChange={e=>onCategory(e.target.value)}>{(panel?.categories??[category]).map(c=><option key={c} value={c}>{c}</option>)}</select></label>
      <label><span>{en?"Table":"Tabla"}</span><select aria-label={en?"Observatory table":"Tabla del observatorio"} value={table} disabled={!panel} onChange={e=>onTable(e.target.value)}>{(panel?.tables??[table]).map(t=><option key={t} value={t}>{t}</option>)}</select></label>
      <div className="vb-observatory-view-controls">
        {!full&&<button type="button" aria-label={en?"Wide view":"Vista horizontal"} aria-pressed={wide} onClick={onWide}><RectangleHorizontal size={17} aria-hidden="true"/></button>}
        <button ref={full?undefined:expandButton} type="button" aria-label={full?(en?"Close full screen":"Cerrar pantalla completa"):(en?"Full screen":"Pantalla completa")} onClick={()=>{if(full)dialog.current?.close();else{onExpandedChange(true);setExpanded(true);}}}>{full?<X size={17} aria-hidden="true"/>:<Maximize2 size={17} aria-hidden="true"/>}</button>
      </div>
      <div className="vb-observatory-history-start" role="group" aria-label={en?"History starts at":"Inicio del historial"}>
        <label><span>{en?"From · month":"Desde · mes"}</span><select aria-label={en?"From month":"Desde el mes"} value={validFromMonth.slice(5)} disabled={!fromYear} onChange={e=>changeStart(`${fromYear}-${e.target.value}`)}><option value="" disabled>{en?"Month":"Mes"}</option>{yearMonths.map(m=><option key={m} value={m}>{new Intl.DateTimeFormat(en?"en-US":"es-MX",{month:"long",timeZone:"UTC"}).format(new Date(`${fromYear}-${m}-01T00:00:00Z`))}</option>)}</select></label>
        <label><span>{en?"Year":"Año"}</span><select aria-label={en?"From year":"Desde el año"} value={fromYear} disabled={!series.length} onChange={e=>changeYear(e.target.value)}><option value="">{en?"All":"Todo"}</option>{years.map(year=><option key={year} value={year}>{year}</option>)}</select></label>
      </div>
    </div>
    <div className="vb-observatory-readout" aria-live="polite" aria-atomic="true">
      <span>{countryLabel(country,lang)} <span aria-hidden="true">·</span> {selected?monthLabel(selected.bulletinMonth,lang):panelError?(en?"Could not load the panel":"No se pudo cargar el panel"):!panel?(en?"Loading the panel":"Cargando el panel"):(en?"No published observations":"Sin observaciones publicadas")}</span>
      <strong data-vb-observation>{panel?display:panelError?(en?"Load failed":"Error de carga"):"—"}</strong>
      <span className="vb-readout-caption">{panelError?(en?"Close this view and reload to try again":"Cierra esta vista y recarga para volver a intentar"):(en?"Published cutoff · historical observation":"Corte publicado · observación histórica")}</span>
    </div>
    <div className="vb-observatory-plot">
      <svg viewBox={`0 0 ${chartWidth} 236`} role="img" aria-label={en?`Historical cutoffs for ${countryLabel(country,lang)} ${category} ${table}`:`Cortes históricos de ${countryLabel(country,lang)} ${category} ${table}`}>
        <defs>
          <linearGradient id={`${id}-line`} gradientUnits="userSpaceOnUse" x1="32" x2={right}><stop stopColor="#67c6ff"/><stop offset="1" stopColor="#c9edff"/></linearGradient>
          <linearGradient id={`${id}-area`} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="48" y2="190"><stop stopColor="#55b9ff" stopOpacity=".24"/><stop offset="1" stopColor="#55b9ff" stopOpacity="0"/></linearGradient>
          <filter id={`${id}-glow`} filterUnits="userSpaceOnUse" x="0" y="0" width={chartWidth} height="236"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        {[0,1,2].map(i=><g key={i} className="vb-instrument-grid"><path d={`M32 ${48+i*71}H${right}`}/>{finite.length>0&&<text x="32" y={40+i*71}>{tick(high-(high-low)*i/2)}</text>}</g>)}
        {segments.map((d,i)=><React.Fragment key={i}>
          <path d={d+` L${Number(d.match(/([\d.]+),[\d.]+$/)?.[1]??32)},190 L${Number(d.match(/^M([\d.]+)/)?.[1]??32)},190 Z`} fill={`url(#${id}-area)`}/>
          <path d={d} className="vb-instrument-glow" stroke={`url(#${id}-line)`} filter={`url(#${id}-glow)`}/>
          <path d={d} className="vb-instrument-line" pathLength="1" stroke={`url(#${id}-line)`}/>
        </React.Fragment>)}
        {isolated.map(i=><circle key={`point-${i}`} cx={x(i)} cy={y(values[i])} r="3" fill="#82d0ff" stroke="#c9edff" strokeWidth="1"><title>{monthLabel(rows[i].bulletinMonth,lang)}: {rows[i].priorityDate}</title></circle>)}
        {selected&&<g className="vb-instrument-cursor"><path d={`M${x(at)} 30V198`}/>{Number.isFinite(values[at])&&<><circle cx={x(at)} cy={y(values[at])} r="13" className="vb-instrument-halo"/><circle cx={x(at)} cy={y(values[at])} r="4.5" className="vb-instrument-point"/></>}</g>}
        <g className="vb-instrument-axis"><text x="32" y="224">{first?monthLabel(first,lang):"—"}</text><text x={right} y="224" textAnchor="end">{last?monthLabel(last,lang):"—"}</text></g>
        {rows.length===0&&<text x={chartWidth/2} y="125" textAnchor="middle" className="vb-instrument-empty">{panelError?(en?"Could not load the panel":"No se pudo cargar el panel"):!panel?(en?"Preparing the historical series":"Preparando la serie histórica"):(en?"No observations for this series":"Sin observaciones para esta serie")}</text>}
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
      <button className="vb-observatory-explore" onClick={()=>{if(full)dialog.current?.close();onExplore();}} disabled={!panel} aria-label={en?"View forecast for this series":"Ver pronóstico de esta serie"}><span className="vb-observatory-explore-label">{en?"View forecast":"Ver pronóstico"}</span><ArrowUpRight size={18} aria-hidden="true"/></button>
    </div>
  </figure>;};
  return <>{instrument(false)}<dialog ref={dialog} className="vb-observatory-dialog" aria-label={en?"Full screen observatory":"Observatorio en pantalla completa"} onClose={()=>{setExpanded(false);onExpandedChange(false);requestAnimationFrame(()=>expandButton.current?.focus());}} onKeyDown={e=>{if(e.key==="Escape")e.stopPropagation();}}>{expanded&&instrument(true)}</dialog></>;
}
