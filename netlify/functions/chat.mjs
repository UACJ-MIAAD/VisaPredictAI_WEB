// VisaBot · grounded generation (Épica C of docs/VISABOT_PLAN.md).
// Thin streaming proxy to Claude. The browser does retrieval and sends the
// numbered context; this function only builds a strict grounded prompt, calls
// Claude with streaming, and relays a tiny SSE protocol. Only secret needed:
// ANTHROPIC_API_KEY (set in Netlify env). No key → 503 {error:"no_key"} so the
// client can fall back to extractive mode.
//
// Protocol (text/event-stream):
//   data: {"t":"delta","text":"..."}
//   data: {"t":"done"}
//   data: {"t":"error","code":"no_key|rate|bad_request|server"}

const MODEL = process.env.VISABOT_MODEL || "claude-haiku-4-5";
const MAX_QUERY = 2000;
const MAX_CTX = 12;
const MAX_HISTORY = 12;
const MAX_OUTPUT = 1536;

// Origin allowlist — the function is public, so gate it to our own site to curb
// off-site abuse that would burn Anthropic credits. Override via env
// VISABOT_ALLOWED_ORIGINS (comma-separated hosts). Netlify deploy previews
// (*.netlify.app) and localhost are always allowed.
const ALLOWED = (process.env.VISABOT_ALLOWED_ORIGINS || "visapredictai.com,www.visapredictai.com")
  .split(",").map((s) => s.trim()).filter(Boolean);
export function originAllowed(req) {
  const ref = req.headers.get("origin") || req.headers.get("referer");
  let host;
  try {
    host = new URL(ref).host.replace(/:\d+$/, "");
  } catch {
    return false; // no parseable Origin/Referer → not a real browser request
  }
  return ALLOWED.includes(host) || host.endsWith(".netlify.app") || host === "localhost" || host === "127.0.0.1";
}

// best-effort per-instance rate limit (ponytail: in-memory, resets on cold
// start — upgrade to a shared store only if abuse is observed)
const hits = new Map();
const RATE = { windowMs: 60_000, max: 20 };
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE.windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE.max;
}

const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;
const errStream = (code) =>
  new Response(sse({ t: "error", code }) , {
    status: code === "no_key" ? 503 : code === "rate" ? 429 : code === "forbidden" ? 403 : 400,
    headers: { "content-type": "text/event-stream" },
  });

function systemPrompt(lang, context) {
  const hasSources = context.length > 0;
  const sources = context
    .map((c) => `[${c.n}] (${c.source}${c.title ? " — " + c.title : ""})\n${c.text}`)
    .join("\n\n");
  const es = `Eres VisaBot, el asistente del proyecto académico VisaPredict AI (anteproyecto MIAAD, UACJ): un sistema que pronostica fechas de prioridad del U.S. Visa Bulletin por país o área de cargabilidad, categoría migratoria y tipo de tabla.

REGLAS:
- No inventes datos, cifras ni fechas. No das asesoría legal migratoria; describes el proyecto, sus datos y su metodología.
- Mantente en tu dominio. Si te piden algo ajeno al proyecto (escribir código, resolver tareas generales, hablar de otros temas), NO lo cumplas: declina en una frase y redirige a lo que sí puedes responder. Ante malestar personal o emocional, responde con empatía en una o dos frases y sugiere buscar apoyo de confianza o profesional, luego redirige; no des consejo clínico ni listas largas de recursos.
- Sé claro y conciso. Usa markdown (listas, **negritas**, tablas pequeñas) cuando ayude. Responde en español.
${hasSources
  ? `- Responde con base en las FUENTES numeradas de abajo y cita las que uses con su número entre corchetes, p. ej. [1], [3], al final de la frase relevante.
- Si la respuesta no está en las fuentes, dilo con claridad y sugiere una sección a consultar.

FUENTES:
${sources}`
  : `- No se recuperaron fuentes para esta consulta. Si es un saludo o charla breve, preséntate como VisaBot en una o dos frases y sugiere 2-3 temas que puedes responder (el U.S. Visa Bulletin, el panel multiserie de datos, los modelos y la metodología CRISP-DM). Si es una pregunta concreta, indica que no encontraste información específica y pide reformularla o ser más específico. No cites fuentes (no hay).`}`;
  const en = `You are VisaBot, the assistant for the VisaPredict AI academic project (MIAAD thesis proposal, UACJ): a system that forecasts U.S. Visa Bulletin priority dates by country or chargeability area, immigration category and table type.

RULES:
- Never invent data, figures or dates. You do not give immigration legal advice; you describe the project, its data and methodology.
- Stay in your domain. If asked for something unrelated to the project (writing code, general tasks, other topics), do NOT fulfill it: decline in one sentence and redirect to what you can answer. If someone expresses personal or emotional distress, respond with empathy in one or two sentences and suggest reaching out for trusted or professional support, then redirect; do not give clinical advice or long resource lists.
- Be clear and concise. Use markdown (lists, **bold**, small tables) when helpful. Answer in English.
${hasSources
  ? `- Answer from the numbered SOURCES below and cite the ones you use with bracketed numbers, e.g. [1], [3], at the end of the relevant sentence.
- If the answer is not in the sources, say so clearly and suggest a section to check.

SOURCES:
${sources}`
  : `- No sources were retrieved for this query. If it's a greeting or brief chit-chat, introduce yourself as VisaBot in one or two sentences and suggest 2-3 topics you can answer (the U.S. Visa Bulletin, the multi-series data panel, the models and the CRISP-DM methodology). If it's a specific question, say you couldn't find specific information and ask the user to rephrase or be more specific. Do not cite sources (there are none).`}`;
  return lang === "en" ? en : es;
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!originAllowed(req)) return errStream("forbidden");

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return errStream("no_key");

  const ip = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "anon";
  if (limited(ip)) return errStream("rate");

  let body;
  try {
    body = await req.json();
  } catch {
    return errStream("bad_request");
  }
  const lang = body?.lang === "en" ? "en" : "es";
  const query = typeof body?.query === "string" ? body.query.slice(0, MAX_QUERY).trim() : "";
  const context = Array.isArray(body?.context) ? body.context.slice(0, MAX_CTX) : [];
  const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY) : [];
  if (!query) return errStream("bad_request"); // empty context is OK (greetings / chit-chat)

  const messages = [
    ...history
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
    { role: "user", content: query },
  ];

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const send = (controller, obj) => controller.enqueue(encoder.encode(sse(obj)));

  // Do the Anthropic fetch INSIDE the stream and emit an immediate heartbeat,
  // so Netlify's edge gets bytes right away and doesn't 504 on cold-start /
  // first-token latency (a comment line `:` is ignored by the SSE client).
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": ok\n\n"));
      let upstream;
      try {
        upstream = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_OUTPUT,
            system: systemPrompt(lang, context),
            messages,
            stream: true,
          }),
        });
      } catch {
        send(controller, { t: "error", code: "server" });
        send(controller, { t: "done" });
        controller.close();
        return;
      }
      if (!upstream.ok || !upstream.body) {
        send(controller, { t: "error", code: "server" });
        send(controller, { t: "done" });
        controller.close();
        return;
      }

      const reader = upstream.body.getReader();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split("\n\n");
          buf = events.pop() || "";
          for (const ev of events) {
            const line = ev.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            try {
              const data = JSON.parse(line.slice(5).trim());
              if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
                send(controller, { t: "delta", text: data.delta.text });
              } else if (data.type === "error") {
                send(controller, { t: "error", code: "server" });
              }
            } catch {
              /* ignore ping / keep-alive lines */
            }
          }
        }
      } catch {
        send(controller, { t: "error", code: "server" });
      }
      send(controller, { t: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
    },
  });
};
