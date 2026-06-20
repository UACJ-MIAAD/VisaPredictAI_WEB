// Mobile test of the console + all 7 charts: opens the sidebar drawer, fires
// each tool, screenshots the result, and measures horizontal overflow
// (scrollWidth - innerWidth) per chart. Viewport 390×844, touch emulation.
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(root, "out");
const PORT = 8092, W = 390, H = 844;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml", ".onnx": "application/octet-stream" };
const server = createServer(async (req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const b = await readFile(join(OUT, p)).catch(() => null); if (!b) { res.writeHead(404); return res.end("nf"); } res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); res.end(b); });
const cdp = (ws, m, p = {}, id) => new Promise((r) => { const on = (e) => { const x = JSON.parse(e.data); if (x.id === id) { ws.removeEventListener("message", on); r(x.result); } }; ws.addEventListener("message", on); ws.send(JSON.stringify({ id, method: m, params: p })); });

const TOOLS = [["carrera", /carrera/i], ["heatmap", /mapa de calor/i], ["radar", /radar/i], ["compare", /comparar/i], ["movimiento", /movim/i], ["estado", /mezcla|c\/f\/u/i], ["evolucion", /evoluci/i]];

await new Promise((r) => server.listen(PORT, r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--no-first-run", `--window-size=${W},${H}`, "--remote-debugging-port=9342", "--user-data-dir=/tmp/vbmob", `http://localhost:${PORT}/asistente/`], { stdio: "ignore" });

const report = { overflow: {}, shots: [] };
let id = 1;
try {
  let u = null;
  for (let i = 0; i < 40 && !u; i++) { await new Promise((r) => setTimeout(r, 250)); try { const t = await (await fetch("http://localhost:9342/json")).json(); const p = t.find((x) => x.type === "page" && x.url.includes("asistente")); if (p) u = p.webSocketDebuggerUrl; } catch {} }
  const ws = new WebSocket(u);
  await new Promise((r) => (ws.onopen = r));
  await cdp(ws, "Runtime.enable", {}, id++);
  await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 3, mobile: true, screenWidth: W, screenHeight: H }, id++);
  await cdp(ws, "Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 }, id++);
  await new Promise((r) => setTimeout(r, 2800));
  for (let i = 0; i < 30; i++) { const e = await cdp(ws, "Runtime.evaluate", { expression: `!!(document.querySelector('aside select')&&document.querySelector('aside select').options.length>1)`, returnByValue: true }, id++); if (e?.result?.value) break; await new Promise((r) => setTimeout(r, 500)); }

  // 1) baseline empty console + overflow
  let ov = await cdp(ws, "Runtime.evaluate", { expression: `document.documentElement.scrollWidth - window.innerWidth`, returnByValue: true }, id++);
  report.overflow.empty = ov?.result?.value;
  let shot = await cdp(ws, "Page.captureScreenshot", { format: "png" }, id++);
  await writeFile("/tmp/visabot-mobile-empty.png", Buffer.from(shot.data, "base64")); report.shots.push("empty");

  // 2) open the CONSOLE command panel (the "Panel" button, not the site-nav menu)
  await cdp(ws, "Runtime.evaluate", { expression: `[...document.querySelectorAll('button')].find(b=>b.querySelector('svg.lucide-sliders-horizontal'))?.click()` }, id++);
  await new Promise((r) => setTimeout(r, 500));
  ov = await cdp(ws, "Runtime.evaluate", { expression: `document.documentElement.scrollWidth - window.innerWidth`, returnByValue: true }, id++);
  report.overflow.drawer = ov?.result?.value;
  const drw = await cdp(ws, "Runtime.evaluate", { expression: `(document.querySelector('aside')?.innerText||'').includes('PANORAMA')||(document.querySelector('aside')?.innerText||'').toUpperCase().includes('HERRAMIENTAS')`, returnByValue: true }, id++);
  report.drawerShowsTools = drw?.result?.value;
  shot = await cdp(ws, "Page.captureScreenshot", { format: "png" }, id++);
  await writeFile("/tmp/visabot-mobile-drawer.png", Buffer.from(shot.data, "base64")); report.shots.push("drawer");
  await cdp(ws, "Runtime.evaluate", { expression: `[...document.querySelectorAll('aside button')].find(b=>b.querySelector('svg.lucide-x'))?.click()` }, id++);
  await new Promise((r) => setTimeout(r, 400));

  // 3) each chart — via the mobile flow: open Panel → tap tool (drawer closes)
  for (const [name, re] of TOOLS) {
    await cdp(ws, "Runtime.evaluate", { expression: `(()=>{const nb=[...document.querySelectorAll('header button')].find(b=>b.querySelector('svg.lucide-plus'));if(nb)nb.click();const s=[...document.querySelectorAll('button')].find(b=>b.querySelector('svg.lucide-sliders-horizontal'));if(s)s.click();const t=[...document.querySelectorAll('aside button')].find(b=>${re}.test(b.innerText));if(t)t.click();return !!t;})()`, returnByValue: true }, id++);
    await new Promise((r) => setTimeout(r, 4000));
    await cdp(ws, "Runtime.evaluate", { expression: `{const l=document.querySelector('[role=log]');if(l)l.scrollTop=l.scrollHeight;}` }, id++);
    await new Promise((r) => setTimeout(r, 600));
    ov = await cdp(ws, "Runtime.evaluate", { expression: `document.documentElement.scrollWidth - window.innerWidth`, returnByValue: true }, id++);
    report.overflow[name] = ov?.result?.value;
    shot = await cdp(ws, "Page.captureScreenshot", { format: "png" }, id++);
    await writeFile(`/tmp/visabot-mobile-${name}.png`, Buffer.from(shot.data, "base64")); report.shots.push(name);
  }
  ws.close();
} catch (e) { report.error = String(e); }
finally { chrome.kill("SIGKILL"); server.close(); }
console.log(JSON.stringify(report, null, 2));
