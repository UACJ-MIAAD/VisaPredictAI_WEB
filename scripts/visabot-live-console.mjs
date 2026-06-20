// Drives the LIVE /asistente console: panel loads, a tool renders a chart, and
// a chartable question yields a (live Claude) cited answer + an inline chart.
import { spawn } from "node:child_process";

const URL_LIVE = process.argv[2] || "https://visapredictai.com/asistente/";
const cdp = (ws, m, p = {}, id) => new Promise((r) => { const on = (e) => { const x = JSON.parse(e.data); if (x.id === id) { ws.removeEventListener("message", on); r(x.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify({ id, method: m, params: p })); });

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9337", "--window-size=1440,900", "--user-data-dir=/tmp/vbchrome5", URL_LIVE], { stdio: "ignore" });

let result = { ok: false };
try {
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { await new Promise((r) => setTimeout(r, 250)); try { const t = await (await fetch("http://localhost:9337/json")).json(); const pg = t.find((x) => x.type === "page" && x.url.includes("asistente")); if (pg) wsUrl = pg.webSocketDebuggerUrl; } catch {} }
  if (!wsUrl) throw new Error("no page target");
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  await cdp(ws, "Runtime.enable", {}, 1);
  await new Promise((r) => setTimeout(r, 3000));
  const drv = await cdp(ws, "Runtime.evaluate", { expression: `(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    let panelLoaded=false;
    for(let i=0;i<30;i++){await sleep(500);const sel=document.querySelector('aside select');if(sel&&sel.options.length>1){panelLoaded=true;break;}}
    const tool=[...document.querySelectorAll('aside button')].find(b=>/comparar|compare/i.test(b.innerText));
    if(tool)tool.click();
    let toolChart=false;
    for(let i=0;i<30;i++){await sleep(500);if(document.querySelector('.vb-bot svg.recharts-surface')){toolChart=true;break;}}
    const ta=document.querySelector('textarea');
    if(ta){const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;set.call(ta,'¿Cómo ha evolucionado la fecha de prioridad de México F3?');ta.dispatchEvent(new Event('input',{bubbles:true}));await sleep(100);ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}
    let chips=0,charts=0,answer='',extractive=true;
    for(let i=0;i<60;i++){await sleep(1000);chips=document.querySelectorAll('.vb-chip').length;charts=document.querySelectorAll('.vb-bot svg.recharts-surface').length;const b=[...document.querySelectorAll('.vb-bot')];answer=b.length?b[b.length-1].innerText:'';extractive=/asistente en vivo no disponible|live assistant offline/i.test(answer);if(chips>0&&charts>=2&&answer.length>40&&!extractive)break;}
    return {panelLoaded,toolChart,chips,charts,extractive,answer:answer.slice(0,160)};
  })()`, awaitPromise: true, returnByValue: true }, 2);
  const v = drv?.result?.value || {};
  result = { ok: v.panelLoaded && v.toolChart && v.chips > 0 && v.charts >= 2 && !v.extractive, ...v };
  ws.close();
} catch (e) { result = { ok: false, error: String(e) }; }
finally { chrome.kill("SIGKILL"); }
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
