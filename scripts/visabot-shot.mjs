// Screenshot the full-viewport /asistente console (desktop) after a tool chart
// + a query render, so the layout can be reviewed. Saves PNG to /tmp.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(root, "out");
const PORT = 8094;
const W = Number(process.argv[2]) || 1440, H = Number(process.argv[3]) || 900;
const DARK = process.argv[4] === "dark";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml", ".onnx": "application/octet-stream" };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const body = await readFile(join(OUT, p)).catch(() => null);
  if (!body) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(body);
});
const cdp = (ws, m, p = {}, id) => new Promise((r) => { const on = (e) => { const x = JSON.parse(e.data); if (x.id === id) { ws.removeEventListener("message", on); r(x.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify({ id, method: m, params: p })); });

await new Promise((r) => server.listen(PORT, r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", `--window-size=${W},${H}`, "--remote-debugging-port=9338", "--user-data-dir=/tmp/vbshot", `http://localhost:${PORT}/asistente/`], { stdio: "ignore" });

let outPath = "";
try {
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { await new Promise((r) => setTimeout(r, 250)); try { const t = await (await fetch("http://localhost:9338/json")).json(); const pg = t.find((x) => x.type === "page" && x.url.includes("asistente")); if (pg) wsUrl = pg.webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  await cdp(ws, "Runtime.enable", {}, 1);
  await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 }, 2);
  await new Promise((r) => setTimeout(r, 2500));
  if (DARK) { await cdp(ws, "Runtime.evaluate", { expression: `document.documentElement.classList.add('dark')` }, 3); await new Promise((r) => setTimeout(r, 300)); }
  // populate: run a tool chart + ask a question
  await cdp(ws, "Runtime.evaluate", { expression: `(async()=>{const s=ms=>new Promise(r=>setTimeout(r,ms));
    const tool=[...document.querySelectorAll('aside button')].find(b=>/evoluci|evolution/i.test(b.innerText));if(tool)tool.click();await s(2500);
    const ta=document.querySelector('textarea');if(ta){const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;set.call(ta,'¿Qué es Dates for Filing?');ta.dispatchEvent(new Event('input',{bubbles:true}));await s(100);ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}await s(4000);})()`, awaitPromise: true }, 4);
  await new Promise((r) => setTimeout(r, 1500));
  const shot = await cdp(ws, "Page.captureScreenshot", { format: "png" }, 5);
  outPath = `/tmp/visabot-console-${W}x${H}${DARK ? "-dark" : ""}.png`;
  await writeFile(outPath, Buffer.from(shot.data, "base64"));
  ws.close();
} catch (e) { console.error("shot failed:", e); }
finally { chrome.kill("SIGKILL"); server.close(); }
console.log(outPath);
