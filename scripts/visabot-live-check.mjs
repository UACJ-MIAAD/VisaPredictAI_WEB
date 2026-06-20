// Drives the LIVE site in real Chrome: opens VisaBot, sends "Hola", captures
// the chat-function HTTP status, request headers (Origin/Referer), console
// errors, and the rendered answer. Diagnoses "doesn't respond".
import { spawn } from "node:child_process";

const URL_LIVE = process.argv[2] || "https://visapredictai.com/";
const cdp = (ws, method, params = {}, id) =>
  new Promise((res) => {
    const on = (e) => { const m = JSON.parse(e.data); if (m.id === id) { ws.removeEventListener("message", on); res(m.result); } };
    ws.addEventListener("message", on);
    ws.send(JSON.stringify({ id, method, params }));
  });

const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=9335", "--user-data-dir=/tmp/vbchrome3", URL_LIVE],
  { stdio: "ignore" });

let result = { ok: false };
try {
  let wsUrl = null;
  for (let i = 0; i < 40 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try { const t = await (await fetch("http://localhost:9335/json")).json(); const p = t.find((x) => x.type === "page" && x.url.includes("visapredictai")); if (p) wsUrl = p.webSocketDebuggerUrl; } catch {}
  }
  if (!wsUrl) throw new Error("no page target");
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => (ws.onopen = r));
  const chatCalls = [];
  const logs = [];
  const reqHeaders = {};
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Network.requestWillBeSent" && /functions\/chat/.test(m.params.request.url)) {
      reqHeaders.origin = m.params.request.headers.Origin || m.params.request.headers.origin || "(none)";
      reqHeaders.referer = m.params.request.headers.Referer || m.params.request.headers.referer || "(none)";
    }
    if (m.method === "Network.responseReceived" && /functions\/chat/.test(m.params.response.url)) chatCalls.push(m.params.response.status);
    if (m.method === "Runtime.consoleAPICalled" && /error|warning/.test(m.params.type)) {
      const t = `${m.params.type}: ${(m.params.args || []).map((a) => a.value || a.description || "").join(" ").slice(0, 200)}`;
      if (!t.includes("Ignoring Event")) logs.push(t);
    }
    if (m.method === "Runtime.exceptionThrown") logs.push(`exc: ${(m.params.exceptionDetails.exception?.description || "").slice(0, 200)}`);
  });
  await cdp(ws, "Network.enable", {}, 1);
  await cdp(ws, "Runtime.enable", {}, 2);
  await new Promise((r) => setTimeout(r, 2500));
  // open + send "Hola"
  await cdp(ws, "Runtime.evaluate", { expression: `(async()=>{
    const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    [...document.querySelectorAll('button')].find(b=>/visabot/i.test(b.getAttribute('aria-label')||''))?.click();
    await sleep(500);
    const ta=document.querySelector('[role=dialog] textarea');
    const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    set.call(ta,'Hola'); ta.dispatchEvent(new Event('input',{bubbles:true}));
    await sleep(100); ta.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  })()`, awaitPromise: true }, 3);
  // wait for an answer to render
  let answer = "(none)";
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const ev = await cdp(ws, "Runtime.evaluate", { expression: `(()=>{const b=[...document.querySelectorAll('.vb-bot')];const l=b[b.length-1];return l?l.innerText:''})()`, returnByValue: true }, 100 + i);
    const txt = ev?.result?.value || "";
    if (txt && !/Hola$/.test(txt) && txt.length > 3 && !txt.includes("Hi 👋") && !txt.includes("Hola 👋")) { answer = txt.slice(0, 200); break; }
    if (chatCalls.length) answer = txt.slice(0, 200) || "(empty bubble)";
  }
  result = { ok: true, chatStatus: chatCalls, reqHeaders, answer: answer.replace(/\n/g, " "), logs: [...new Set(logs)].slice(0, 8) };
  ws.close();
} catch (e) { result = { ok: false, error: String(e) }; }
finally { chrome.kill("SIGKILL"); }
console.log(JSON.stringify(result, null, 2));
