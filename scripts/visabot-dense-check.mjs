// Verifies the on-device embedding model in a real browser, now that loading is
// CONSENT-GATED (AZ1): from a pristine profile the model must NOT download until
// the user clicks "Activar búsqueda semántica". So this checks TWO things:
//   1. the gate holds — zero /models/ or /ort/ requests before the click;
//   2. after clicking, the engine loads (ready pill) with no failed assets.
import { createServer } from "node:http";
import { readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(root, "out");
const PORT = 8097;
const PROFILE = "/tmp/vbchrome2";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".css": "text/css", ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml", ".onnx": "application/octet-stream" };

// apply the REAL production CSP from netlify.toml so this test actually exercises it
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

const cdp = (ws, method, params = {}, id) =>
  new Promise((resolve) => {
    const onMsg = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener("message", onMsg); resolve(m.result); } };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });

await new Promise((r) => server.listen(PORT, r));
// pristine profile: no leftover localStorage vb-semantic-ok, so the consent
// gate is exercised deterministically (a prior run's consent would auto-resume).
await rm(PROFILE, { recursive: true, force: true });
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9334", `--user-data-dir=${PROFILE}`, `http://localhost:${PORT}/`],
  { stdio: "ignore" });

let result = { ok: false, pill: null, panel: null };
try {
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const t = await (await fetch("http://localhost:9334/json")).json();
      const page = t.find((x) => x.type === "page" && x.url.includes(`:${PORT}`));
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch {}
  }
  if (!wsUrl) throw new Error("no page target");
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  const failures = [];
  const logs = [];
  const modelRequests = []; // any /models/ or /ort/ fetch — must be empty pre-consent
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Network.requestWillBeSent" && /\/(models|ort)\//.test(m.params.request.url))
      modelRequests.push(m.params.request.url.split("/").slice(-1)[0].split("?")[0]);
    if (m.method === "Network.responseReceived") {
      const r = m.params.response;
      if (r.status >= 400 && /\/(models|ort|rag)\//.test(r.url)) failures.push(`${r.status} ${r.url.split("/").slice(-2).join("/")}`);
    }
    if (m.method === "Network.loadingFailed" && /models|ort|rag/.test(m.params.requestId)) failures.push(`failed ${m.params.errorText}`);
    if (m.method === "Runtime.consoleAPICalled" && /error|warning/.test(m.params.type)) {
      const txt = `${m.params.type}: ${(m.params.args || []).map((a) => a.value || a.description || "").join(" ").slice(0, 300)}`;
      if (!txt.includes("Ignoring Event")) logs.push(txt);
    }
    if (m.method === "Runtime.exceptionThrown")
      logs.push(`exc: ${(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").slice(0, 220)}`);
  });
  await cdp(ws, "Network.enable", {}, 1);
  await cdp(ws, "Runtime.enable", {}, 2);
  await cdp(ws, "Page.enable", {}, 3);
  await cdp(ws, "Page.reload", { ignoreCache: true }, 4);
  await new Promise((r) => setTimeout(r, 2500));
  // open the bot — this alone must NOT download the model (consent gate)
  await cdp(ws, "Runtime.evaluate", { expression: `[...document.querySelectorAll('button')].find(b=>/visabot/i.test(b.getAttribute('aria-label')||''))?.click()` }, 5);
  await new Promise((r) => setTimeout(r, 3000));
  const gateHeld = modelRequests.length === 0;
  const preConsentRequests = [...modelRequests];
  // click "Activar búsqueda semántica" / "Enable semantic search" to opt in
  // (.click() returns undefined, so report whether the button was FOUND).
  const clicked = await cdp(ws, "Runtime.evaluate", {
    expression: `(() => { const b = [...document.querySelectorAll('button')].find(b=>/activar búsqueda sem|enable semantic/i.test(b.textContent||'')); if (b) { b.click(); return true; } return false; })()`,
    returnByValue: true,
  }, 6);
  // now (and only now) poll for the "engine ready" pill (dense retrieval live)
  let ready = false, pill = "(none)";
  for (let i = 0; i < 75 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const ev = await cdp(ws, "Runtime.evaluate", { expression: `(document.querySelector('[role=dialog] header')?.innerText||'')`, returnByValue: true }, 100 + i);
    pill = ev?.result?.value || "";
    ready = /activo|active/i.test(pill) && /motor|semantic|engine/i.test(pill);
  }
  result = {
    ok: gateHeld && ready,
    consentGateHeld: gateHeld,
    preConsentModelRequests: preConsentRequests,
    consentButtonClicked: clicked?.result?.value ?? false,
    modelReady: ready,
    pill: pill.replace(/\n/g, " ").slice(0, 80),
    assetFailures: [...new Set(failures)],
    logs: [...new Set(logs)].slice(0, 10),
  };
  ws.close();
} catch (e) {
  result = { ok: false, error: String(e) };
} finally {
  chrome.kill("SIGKILL");
  server.close();
}
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
