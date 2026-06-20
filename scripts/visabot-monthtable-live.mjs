// Live check of the monthly Visa Bulletin table against PROD. Waits for the
// new deploy (meta.json built > baseline), then drives the console: fires the
// "Tabla del mes" tool (default latest month) and types a historical query
// ("tabla de marzo 2010"), asserting a real table renders with date cells.
import { spawn } from "node:child_process";

const URL = "https://visapredictai.com/asistente/";
const baseline = process.argv[2] || "";
const cdp = (ws, m, p = {}, id) => new Promise((r) => { const on = (e) => { const x = JSON.parse(e.data); if (x.id === id) { ws.removeEventListener("message", on); r(x.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify({ id, method: m, params: p })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) wait for the new deploy
let built = "";
for (let i = 0; i < 40; i++) {
  try { const m = await (await fetch("https://visapredictai.com/rag/meta.json", { cache: "no-store" })).json(); built = m.built || ""; if (built && built > baseline) break; } catch {}
  await sleep(15000);
}
console.log("deploy built:", built, built > baseline ? "(NEW ✓)" : "(not newer — proceeding anyway)");

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--no-first-run", "--window-size=1440,900", "--remote-debugging-port=9343", "--user-data-dir=/tmp/vbmt", URL], { stdio: "ignore" });
const out = { built };
let id = 1;
try {
  let u = null;
  for (let i = 0; i < 40 && !u; i++) { await sleep(300); try { const t = await (await fetch("http://localhost:9343/json")).json(); const p = t.find((x) => x.type === "page" && x.url.includes("asistente")); if (p) u = p.webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(u);
  await new Promise((r) => (ws.onopen = r));
  await cdp(ws, "Runtime.enable", {}, id++);
  // wait for panel (selects populated)
  for (let i = 0; i < 40; i++) { const e = await cdp(ws, "Runtime.evaluate", { expression: `!!(document.querySelector('aside select')&&document.querySelector('aside select').options.length>1)`, returnByValue: true }, id++); if (e?.result?.value) break; await sleep(500); }

  // A) fire the "Tabla del mes" tool (default = latest month)
  await cdp(ws, "Runtime.evaluate", { expression: `[...document.querySelectorAll('aside button')].find(b=>/tabla del mes/i.test(b.innerText))?.click()` }, id++);
  await sleep(5000);
  const tA = await cdp(ws, "Runtime.evaluate", { expression: `(()=>{const t=document.querySelector('figure table');if(!t)return{table:false};const cap=document.querySelector('figure figcaption')?.innerText||'';const dates=[...t.querySelectorAll('td')].filter(td=>/\\d{4}/.test(td.innerText)).length;const badges=[...t.querySelectorAll('td')].filter(td=>td.innerText.trim()==='C'||td.innerText.trim()==='U').length;return{table:true,cap,rows:t.querySelectorAll('tbody tr').length,dates,badges};})()`, returnByValue: true }, id++);
  out.tool = tA?.result?.value;

  // B) historical query via the textarea
  await cdp(ws, "Runtime.evaluate", { expression: `(()=>{const ta=document.querySelector('textarea');const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;set.call(ta,'tabla de marzo 2010');ta.dispatchEvent(new Event('input',{bubbles:true}));})()` }, id++);
  await sleep(300);
  await cdp(ws, "Runtime.evaluate", { expression: `(()=>{const ta=document.querySelector('textarea');ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()` }, id++);
  await sleep(8000);
  const tB = await cdp(ws, "Runtime.evaluate", { expression: `(()=>{const figs=[...document.querySelectorAll('figure')];const f=figs[figs.length-1];const t=f?.querySelector('table');if(!t)return{table:false};const cap=f.querySelector('figcaption')?.innerText||'';const has1987=/1987/.test(t.innerText);return{table:true,cap,has1987,rows:t.querySelectorAll('tbody tr').length};})()`, returnByValue: true }, id++);
  out.historical = tB?.result?.value;

  const shot = await cdp(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: true }, id++);
  const { writeFile } = await import("node:fs/promises");
  await writeFile("/tmp/visabot-monthtable.png", Buffer.from(shot.data, "base64"));
  ws.close();
} catch (e) { out.error = String(e); }
finally { chrome.kill("SIGKILL"); }
console.log(JSON.stringify(out, null, 2));
