// Full-format Anthropic Messages SSE for tests of the VisaBot agent. The
// official SDK (used by netlify/functions/chat.mjs through lib/visabot/agent.mjs)
// assembles a Message from these events, so a mock must carry the `event:`
// names, content_block_start/stop and the usage the real API sends.
export type MockTool = { id: string; name: string; input: Record<string, unknown> };
export type MockTurn = {
  text?: string[]; // text deltas of one text block
  tools?: MockTool[];
  stop?: "end_turn" | "tool_use" | "max_tokens" | "refusal";
  inputTokens?: number;
  outputTokens?: number;
  omitStop?: boolean; // end the stream without message_delta/message_stop
};

const ev = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export function sseStart(inputTokens = 10) {
  return ev("message_start", {
    type: "message_start",
    message: { id: "msg_test", type: "message", role: "assistant", model: "claude-test", content: [],
      stop_reason: null, stop_sequence: null, usage: { input_tokens: inputTokens, output_tokens: 1 } },
  });
}
export const sseTextStart = (index = 0) => ev("content_block_start", { type: "content_block_start", index, content_block: { type: "text", text: "" } });
export const sseTextDelta = (text: string, index = 0) => ev("content_block_delta", { type: "content_block_delta", index, delta: { type: "text_delta", text } });
export const sseBlockStop = (index = 0) => ev("content_block_stop", { type: "content_block_stop", index });
export const sseEnd = (stop: string, outputTokens = 5) =>
  ev("message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: outputTokens } }) +
  ev("message_stop", { type: "message_stop" });

export function anthropicSSE(turn: MockTurn): string {
  let out = sseStart(turn.inputTokens);
  let i = 0;
  if (turn.text?.length) {
    out += sseTextStart(i);
    for (const t of turn.text) out += sseTextDelta(t, i);
    out += sseBlockStop(i);
    i++;
  }
  for (const tool of turn.tools ?? []) {
    out += ev("content_block_start", { type: "content_block_start", index: i, content_block: { type: "tool_use", id: tool.id, name: tool.name, input: {} } });
    out += ev("content_block_delta", { type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify(tool.input) } });
    out += sseBlockStop(i);
    i++;
  }
  if (turn.omitStop) return out;
  return out + sseEnd(turn.stop ?? (turn.tools?.length ? "tool_use" : "end_turn"), turn.outputTokens);
}

export const sseResponse = (body: BodyInit) =>
  new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
