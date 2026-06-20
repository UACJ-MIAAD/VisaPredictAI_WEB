// Clicks each console tool in turn and screenshots the resulting chart, so the
// full brutal chart set can be reviewed. Serves out/ at desktop size.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(root, "out");
const PORT = 8093;
const W = 1280, H = 880;
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

// tool label regexes (ES) in sidebar order
const TOOLS = [
  ["evolucion", /evoluci/i], ["compare", /comparar/i], ["movimiento", /movim/i],
  ["estado", /mezcla|c\/f\/u/i], ["carrera", /carrera/i], ["heatmap", /mapa de calor/i], ["radar", /radar/i],
];

await new Promise((r) => server.listen(PORT, r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", `--window-size=${W},${H}`, "--remote-debugging-port=9339", "--user-data-dir=/tmp/vbshot2", `http://localhost:${PORT}/asistente/`], { stdio: "ignore" });

const saved = [];
let id = 1;
try {
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) { await new Promise((r) => setTimeout(r, 250)); try { const t = await (await fetch("http://localhost:9339/json")).json(); const pg = t.find((x) => x.type === "page" && x.url.includes("asistente")); if (pg) wsUrl = pg.webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  await cdp(ws, "Runtime.enable", {}, id++);
  await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: false }, id++);
  await new Promise((r) => setTimeout(r, 2500));
  // wait for panel
  for (let i = 0; i < 30; i++) { const ev = await cdp(ws, "Runtime.evaluate", { expression: `!!(document.querySelector('aside select')&&document.querySelector('aside select').options.length>1)`, returnByValue: true }, id++); if (ev?.result?.value) break; await new Promise((r) => setTimeout(r, 500)); }

  for (const [name, re] of TOOLS) {
    // new chat to keep one chart per shot, then click the tool
    await cdp(ws, "Runtime.evaluate", { expression: `(()=>{const nb=[...document.querySelectorAll('header button')].find(b=>b.querySelector('svg.lucide-plus')); if(nb)nb.click();
      const t=[...document.querySelectorAll('aside button')].find(b=>${re}.test(b.innerText)); if(t)t.click(); return !!t;})()`, returnByValue: true }, id++);
    await new Promise((r) => setTimeout(r, 4000)); // let lazy Recharts + chart render
    await cdp(ws, "Runtime.evaluate", { expression: `{const s=document.querySelector('[id=asistente] [role=log]'); if(s)s.scrollTop=s.scrollHeight;}` }, id++);
    await new Promise((r) => setTimeout(r, 600));
    const shot = await cdp(ws, "Page.captureScreenshot", { format: "png" }, id++);
    const path = `/tmp/visabot-chart-${name}.png`;
    await writeFile(path, Buffer.from(shot.data, "base64"));
    saved.push(path);
    console.log("saved", path);
  }
  ws.close();
} catch (e) { console.error("shot failed:", e); }
finally { chrome.kill("SIGKILL"); server.close(); }
console.log(JSON.stringify(saved));
