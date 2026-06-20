// Headless check of the dedicated /asistente console: stats load from meta.json,
// the inline chat renders, and sending a question produces a cited answer
// (extractive locally — no function). Serves out/ under the prod CSP.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(root, "out");
const PORT = 8096;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml", ".onnx": "application/octet-stream" };
const toml = await readFile(join(root, "netlify.toml"), "utf8");
const CSP = (toml.match(/Content-Security-Policy = "([^"]+)"/) || [, ""])[1];

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  let body = await readFile(join(OUT, p)).catch(() => null);
  if (!body) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "Content-Security-Policy": CSP });
  res.end(body);
});
const cdp = (ws, m, p = {}, id) => new Promise((r) => { const on = (e) => { const x = JSON.parse(e.data); if (x.id === id) { ws.removeEventListener("message", on); r(x.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify({ id, method: m, params: p })); });

await new Promise((r) => server.listen(PORT, r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9336", "--user-data-dir=/tmp/vbchrome4", `http://localhost:${PORT}/asistente/`], { stdio: "ignore" });

let result = { ok: false };
try {
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { await new Promise((r) => setTimeout(r, 250)); try { const t = await (await fetch("http://localhost:9336/json")).json(); const pg = t.find((x) => x.type === "page" && x.url.includes("asistente")); if (pg) wsUrl = pg.webSocketDebuggerUrl; } catch {} }
  if (!wsUrl) throw new Error("no page target");
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  const logs = [];
  ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.method === "Runtime.consoleAPICalled" && /error/.test(m.params.type)) { const t = (m.params.args || []).map((a) => a.value || a.description || "").join(" "); if (!t.includes("Ignoring Event")) logs.push(t.slice(0, 160)); } if (m.method === "Runtime.exceptionThrown") logs.push("exc: " + (m.params.exceptionDetails.exception?.description || "").slice(0, 160)); });
  await cdp(ws, "Runtime.enable", {}, 1);
  await cdp(ws, "Page.enable", {}, 2);
  await cdp(ws, "Page.reload", { ignoreCache: true }, 3);
  await new Promise((r) => setTimeout(r, 3000));
  const drv = await cdp(ws, "Runtime.evaluate", { expression: `(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const txt=document.body.innerText;
    const hasConsole=!!document.querySelector('.vb-console textarea');
    const statChunks=/\\b587\\b/.test(txt);
    const ta=document.querySelector('.vb-console textarea');
    if(ta){const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;set.call(ta,'¿Qué es Final Action Dates?');ta.dispatchEvent(new Event('input',{bubbles:true}));await sleep(100);ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}
    let answer='',chips=0;
    for(let i=0;i<40;i++){await sleep(500);const b=[...document.querySelectorAll('.vb-bot')];const l=b[b.length-1];answer=l?l.innerText:'';chips=document.querySelectorAll('.vb-chip').length;if(answer&&answer.length>30&&chips>0)break;}
    return {hasConsole,statChunks,sections:[...document.querySelectorAll('section[id]')].map(s=>s.id),chips,answer:answer.slice(0,120)};
  })()`, awaitPromise: true, returnByValue: true }, 4);
  const v = drv?.result?.value || {};
  result = { ok: v.hasConsole && v.statChunks && v.chips > 0, ...v, logs: [...new Set(logs)].slice(0, 6) };
  ws.close();
} catch (e) { result = { ok: false, error: String(e) }; }
finally { chrome.kill("SIGKILL"); server.close(); }
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
