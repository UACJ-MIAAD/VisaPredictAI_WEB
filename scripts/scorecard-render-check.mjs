// Headless render check for the prospective-accuracy leaderboard on /datos-historicos.
// Serves out/, drives real Chrome via CDP, and for each width × theme verifies the
// Scorecard section hydrates (it fetches /data/forecast_scorecard.json client-side),
// renders its stats + chart, and introduces NO horizontal overflow / console error.
// Run: node scripts/scorecard-render-check.mjs   (after `npm run build`)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(root, "out");
const PORT = 8097;
const DBG = 9334;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv" };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  let body = await readFile(join(OUT, p)).catch(() => null);
  if (!body) body = await readFile(join(OUT, p, "index.html")).catch(() => null);
  if (!body) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" });
  res.end(body);
});

let _id = 1;
const cdp = (ws, method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = _id++;
    const onMsg = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === id) {
        ws.removeEventListener("message", onMsg);
        if (m.error) reject(new Error(m.error.message));
        else resolve(m.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });

await new Promise((r) => server.listen(PORT, r));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", `--remote-debugging-port=${DBG}`, "--user-data-dir=/tmp/sccheck", "about:blank"],
  { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 40 && !wsUrl; i++) {
  await sleep(150);
  try {
    const t = await (await fetch(`http://localhost:${DBG}/json`)).json();
    const page = t.find((x) => x.type === "page");
    if (page) wsUrl = page.webSocketDebuggerUrl;
  } catch {}
}
if (!wsUrl) { console.error("no chrome"); process.exit(2); }

const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
await cdp(ws, "Page.enable");
await cdp(ws, "Runtime.enable");

const PAGE_URL = `http://localhost:${PORT}/datos-historicos/`;
const VIEWPORTS = [{ w: 390, h: 844, label: "móvil" }, { w: 768, h: 1024, label: "tablet" }, { w: 1280, h: 900, label: "desktop" }];
const THEMES = ["light", "dark"];

const PROBE = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let title = null;
  for (let i = 0; i < 60; i++) { // hasta ~9s: el scorecard hidrata tras fetch del JSON
    title = document.getElementById('scorecard-title');
    if (title && /\\d/.test(document.body.innerText)) break;
    await sleep(150);
  }
  const sec = title ? title.closest('section') : null;
  const txt = sec ? sec.innerText : '';
  const de = document.documentElement;
  const overflow = de.scrollWidth - de.clientWidth;
  const svg = sec ? sec.querySelector('svg') : null;
  // ¿alguna stat-card se sale del ancho de la sección?
  let cardOverflow = false;
  if (sec) for (const el of sec.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth + 1) { cardOverflow = true; break; }
  }
  return JSON.stringify({
    found: !!title,
    hasMAE: /145|146/.test(txt),
    hasMASE: /0\\.34/.test(txt),
    hasCov: /92\\s*%/.test(txt),
    hasChart: !!svg,
    chartBars: sec ? sec.querySelectorAll('.recharts-bar-rectangle, path.recharts-rectangle').length : 0,
    overflowPx: overflow,
    cardOverflow,
    errs: (window.__e||[]).slice(0,3),
  });
})()`;

let allPass = true;
for (const t of THEMES) {
  await cdp(ws, "Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: t }] });
  for (const v of VIEWPORTS) {
    await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: v.w, height: v.h, deviceScaleFactor: 1, mobile: v.w < 700 });
    await cdp(ws, "Page.navigate", { url: PAGE_URL });
    await sleep(300);
    await cdp(ws, "Runtime.evaluate", { expression: "window.__e=[];addEventListener('error',e=>window.__e.push(String(e.message)))" });
    const res = await cdp(ws, "Runtime.evaluate", { expression: PROBE, awaitPromise: true, returnByValue: true });
    const r = JSON.parse(res.result.value);
    const ok = r.found && r.hasMAE && r.hasMASE && r.hasChart && r.chartBars >= 10 && r.overflowPx <= 1 && !r.cardOverflow && r.errs.length === 0;
    allPass = allPass && ok;
    console.log(
      `${ok ? "✓" : "✗"} ${t.padEnd(5)} ${v.label.padEnd(8)} ${String(v.w).padStart(4)}px | ` +
      `sección:${r.found?"sí":"NO"} MAE:${r.hasMAE?"sí":"no"} MASE:${r.hasMASE?"sí":"no"} cov:${r.hasCov?"sí":"no"} ` +
      `chart:${r.hasChart?"sí":"no"}(${r.chartBars} barras) overflow:${r.overflowPx}px cardOverflow:${r.cardOverflow} errs:${r.errs.length}`
    );
    if (r.errs.length) console.log("    errores:", r.errs);
  }
}

ws.close();
chrome.kill();
server.close();
console.log(allPass ? "\n✓ RENDER OK — leaderboard sólido en 3 anchos × 2 temas" : "\n✗ revisar arriba");
process.exit(allPass ? 0 : 1);
