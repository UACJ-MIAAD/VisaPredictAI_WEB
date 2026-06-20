// Headless smoke test for VisaBot's client path: serve out/, drive the UI in
// real Chrome via CDP (open → ask → retrieve → answer with citations).
// No LLM key locally → exercises the extractive fallback + BM25 retrieval.
// Run: node scripts/visabot-smoke.mjs   (after `npm run build`)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(root, "out");
const PORT = 8099;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml", ".csv": "text/csv", ".onnx": "application/octet-stream" };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    let file = join(OUT, p);
    let body;
    try {
      body = await readFile(file);
    } catch {
      body = await readFile(join(OUT, p, "index.html")).catch(() => null);
      if (!body) {
        res.writeHead(404);
        return res.end("nf");
      }
    }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("err");
  }
});

const cdp = (ws, method, params = {}, id) =>
  new Promise((resolve) => {
    const onMsg = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === id) {
        ws.removeEventListener("message", onMsg);
        resolve(m.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });

const DRIVER = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__errs = window.__errs || [];
  window.addEventListener('error', (e) => window.__errs.push(String(e.message || e.error)));
  window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej:' + String(e.reason)));
  const find = () => [...document.querySelectorAll('button')].find((b) => /visabot/i.test(b.getAttribute('aria-label') || ''));
  const launcher = find();
  if (!launcher) return { ok: false, step: 'launcher' };
  launcher.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await sleep(1500);
  const ta = document.querySelector('[role=dialog] textarea');
  if (!ta) {
    // toggle theme as a hydration probe
    const themeBtn = [...document.querySelectorAll('button')].find((b) => /modo|mode/i.test(b.getAttribute('aria-label') || ''));
    const beforeDark = document.documentElement.classList.contains('dark');
    themeBtn?.click();
    await sleep(300);
    const afterDark = document.documentElement.classList.contains('dark');
    return { ok: false, step: 'textarea',
      launcherStillThere: !!find(),
      hydrationWorks: beforeDark !== afterDark,
      panels: document.querySelectorAll('.vb-panel').length,
      errs: window.__errs.slice(0, 6) };
  }
  const sugg = document.querySelectorAll('.vb-suggest').length;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  setter.call(ta, '¿Qué es Dates for Filing?');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(150);
  ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  for (let i = 0; i < 50; i++) {
    await sleep(500);
    const bots = [...document.querySelectorAll('.vb-bot')];
    const last = bots[bots.length - 1];
    const txt = last ? (last.innerText || '') : '';
    const chips = document.querySelectorAll('.vb-chip').length;
    const cites = document.querySelectorAll('.vb-cite').length;
    if (txt && txt.length > 40 && chips > 0) return { ok: true, sugg, chips, cites, txt: txt.slice(0, 240) };
  }
  return { ok: false, step: 'answer', sugg, bots: document.querySelectorAll('.vb-bot').length };
})()`;

await new Promise((r) => server.listen(PORT, r));
const chrome = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9333", "--user-data-dir=/tmp/vbchrome", `http://localhost:${PORT}/`],
  { stdio: "ignore" },
);

let result = { ok: false, step: "init" };
try {
  // wait for the page target
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const targets = await (await fetch("http://localhost:9333/json")).json();
      const page = targets.find((t) => t.type === "page" && t.url.includes(`:${PORT}`));
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch {}
  }
  if (!wsUrl) throw new Error("no page target");
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  const logs = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.consoleAPICalled" && /error|warn/.test(m.params.type))
      logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value || a.description || "").join(" ").slice(0, 200)}`);
    if (m.method === "Runtime.exceptionThrown")
      logs.push(`exc: ${(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").slice(0, 200)}`);
  });
  await cdp(ws, "Runtime.enable", {}, 1);
  await cdp(ws, "Page.enable", {}, 2);
  await cdp(ws, "Page.reload", { ignoreCache: true }, 3);
  await new Promise((r) => setTimeout(r, 3500)); // let it hydrate with logging on
  const ev = await cdp(ws, "Runtime.evaluate", { expression: DRIVER, awaitPromise: true, returnByValue: true }, 4);
  result = ev?.result?.value ?? { ok: false, step: "evaluate", raw: ev };
  result.consoleLogs = logs.slice(0, 8);
  ws.close();
} catch (e) {
  result = { ok: false, step: "cdp", error: String(e) };
} finally {
  chrome.kill("SIGKILL");
  server.close();
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
