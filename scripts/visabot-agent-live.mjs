// Live check of the VisaBot agent against the REAL model, run locally.
// Serves public/ on a local port (the function's data base), calls the real
// chat handler and checks the answers to the questions production got wrong
// on 18-nov-2026. Spends model credits: needs ANTHROPIC_API_KEY.
//
//   ANTHROPIC_API_KEY=... node scripts/visabot-agent-live.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY is required"); process.exit(2); }
const pub = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try { res.end(await readFile(join(pub, p))); } catch { res.statusCode = 404; res.end(); }
}).listen(0);
const port = server.address().port;
process.env.VISABOT_DATA_BASE = `http://127.0.0.1:${port}`;
const { default: handler } = await import("../netlify/functions/chat.mjs");

const CASES = [
  { q: "por que mexico F4 avanza tan lento y cuanto tardaria alguien que aplica hoy?", must: [/22 de abril de 2001|2001-04-22/], mustNot: [/2012/] },
  { q: "Soy de México, F2B, mi fecha de prioridad es marzo 2010. ¿Cuándo me toca?", must: [/al corriente|ya es anterior|ya está/i], mustNot: [/AAAA-MM-DD/] },
  { q: "¿Qué cambió en el último boletín para India?", must: [/India/] },
  { q: "¿Qué modelo usa el sistema y qué tan preciso es?", must: [/MASE/] },
];
let fail = 0;
for (const [i, c] of CASES.entries()) {
  const t0 = Date.now();
  const res = await handler(new Request("http://localhost/.netlify/functions/chat", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json", "x-nf-client-connection-ip": `10.99.0.${i + 1}` },
    body: JSON.stringify({ lang: "es", query: c.q, surface: "console" }),
  }));
  const frames = (await res.text()).split("\n\n").map((e) => e.replace(/^data: /, "")).filter((p) => p.startsWith("{")).map((p) => JSON.parse(p));
  const answer = frames.filter((f) => f.t === "delta").map((f) => f.text).join("");
  const tools = frames.filter((f) => f.t === "status").map((f) => f.text);
  const ok = res.status === 200 && !frames.some((f) => f.t === "error") &&
    c.must.every((r) => r.test(answer)) && !(c.mustNot ?? []).some((r) => r.test(answer));
  if (!ok) fail++;
  console.log(`\n${ok ? "PASS" : "FAIL"} [${((Date.now() - t0) / 1000).toFixed(1)} s] ${c.q}\n  tools: ${tools.join(" | ") || "none"}\n  chart: ${JSON.stringify(frames.find((f) => f.t === "chart")?.chart ?? null)}\n${answer.replace(/^/gm, "  > ")}`);
}
server.close();
console.log(`\n${CASES.length - fail}/${CASES.length} passed`);
process.exit(fail ? 1 : 0);
