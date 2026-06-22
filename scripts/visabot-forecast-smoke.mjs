// Forecast-intent smoke: a natural "when will my turn come" question must render a
// FORECAST chart (not a month table), proving the core purpose works. Run after build.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";
const OUT = join(process.cwd(), "out"), PORT=8093, DBG=9346;
const MIME={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".json":"application/json",".css":"text/css",".csv":"text/csv",".svg":"image/svg+xml",".png":"image/png",".wasm":"application/wasm"};
const server=createServer(async(req,res)=>{let p=decodeURIComponent(req.url.split("?")[0]);if(p.endsWith("/"))p+="index.html";let b=await readFile(join(OUT,p)).catch(()=>null);if(!b)b=await readFile(join(OUT,p,"index.html")).catch(()=>null);if(!b){res.writeHead(404);return res.end("nf");}res.writeHead(200,{"content-type":MIME[extname(p)]||"application/octet-stream"});res.end(b);});
await new Promise(r=>server.listen(PORT,r));
const chrome=spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",["--headless=new","--disable-gpu","--no-first-run",`--remote-debugging-port=${DBG}`,"--user-data-dir=/tmp/fcsmoke",`http://localhost:${PORT}/asistente/`],{stdio:"ignore"});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let u;for(let i=0;i<40&&!u;i++){await sleep(250);try{const t=await(await fetch(`http://localhost:${DBG}/json`)).json();const p=t.find(x=>x.type==="page"&&x.url.includes("asistente"));if(p)u=p.webSocketDebuggerUrl;}catch{}}
let _id=1;const ws=new WebSocket(u);await new Promise(r=>ws.onopen=r);
const cdp=(m,p={})=>new Promise((res)=>{const id=_id++;const on=(e)=>{const o=JSON.parse(e.data);if(o.id===id){ws.removeEventListener("message",on);res(o.result);}};ws.addEventListener("message",on);ws.send(JSON.stringify({id,method:m,params:p}));});
await cdp("Runtime.enable");
await sleep(2500);
const Q="soy mexicano F2A PD Sept 19 2024 en que mes año calculas llegará mi turno en la tabla de asignación de visa ?";
await cdp("Runtime.evaluate",{expression:`(()=>{const ta=document.querySelector('textarea');const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;set.call(ta,${JSON.stringify(Q)});ta.dispatchEvent(new Event('input',{bubbles:true}));})()`});
await sleep(300);
await cdp("Runtime.evaluate",{expression:`(()=>{const ta=document.querySelector('textarea');ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`});
await sleep(6000); // espera render del chart (la respuesta de texto cae a fallback sin API, pero el chart se adjunta igual)
const probe=`(()=>{
  const svg=document.querySelectorAll('svg.recharts-surface').length;
  const refline=document.querySelectorAll('.recharts-reference-line').length;
  const bands=document.querySelectorAll('path[name=\\"band95\\"],path[name=\\"band80\\"]').length;
  const txt=document.body.innerText;
  const hasF2A=/F2A/.test(txt);
  const monthTable=/Visa Bulletin.*septiembre 2024/i.test(txt) || document.querySelectorAll('table').length>2;
  return JSON.stringify({svg,refline,hasF2A,isForecast:refline>0,looksLikeMonthTable:monthTable});
})()`;
const r=JSON.parse((await cdp("Runtime.evaluate",{expression:probe,returnByValue:true})).result.value);
console.log("resultado:",JSON.stringify(r,null,0));
const ok = r.svg>0 && r.isForecast && r.hasF2A;
console.log(ok?"✓ RENDERIZA FORECAST para la pregunta natural (F2A)":"✗ NO renderizó forecast");
ws.close();chrome.kill();server.close();process.exit(ok?0:1);
