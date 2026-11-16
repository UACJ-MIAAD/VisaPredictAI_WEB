import { afterEach, describe, expect, it, vi } from "vitest";
import { generate } from "@/components/visabot/engine";
import { isTruncated } from "@/components/visabot/observability";

afterEach(() => vi.unstubAllGlobals());
describe("client stream failures", () => {
  it("recovers retrieval after a transient index download failure", async () => {
    vi.resetModules();
    const { retrieve } = await import("@/components/visabot/engine");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json({dim: 0, chunks: [{lang: "es", kind: "glossary", sourceId: "glosario", title: "Retrogresión", source: "Glosario", url: "/", text: "Retrogresión significa retroceso."}]})));
    await expect(retrieve("retrogresión", "es")).rejects.toThrow();
    expect(await retrieve("retrogresión", "es")).toHaveLength(1);
  });
  it("accepts CRLF SSE even when byte chunks split the CRLF and UTF-8 character", async () => {
    const bytes = new TextEncoder().encode('data: {"t":"delta","text":"México"}\r\n\r\ndata: {"t":"done"}\r\n\r\n');
    const stream = new ReadableStream({start(c) { for (const b of bytes) c.enqueue(Uint8Array.of(b)); c.close(); }});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
    const answer = await generate("FAD", [], [], "es", () => {});
    expect(answer.text).toBe("México");
    expect(answer.extractive).toBe(false);
  });
  it("never turns cancellation into an offline answer", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("stopped", "AbortError")));
    await expect(generate("FAD", [], [], "es", () => {}, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
  it("falls back when a successful HTTP response contains no answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('data: {"t":"sources","sources":[]}\n\ndata: {"t":"done"}\n\n')));
    expect((await generate("FAD", [], [], "es", () => {})).extractive).toBe(true);
  });
  it("marks a partial stream ending in error as incomplete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('data: {"t":"delta","text":"Dato parcial"}\n\ndata: {"t":"error","code":"upstream"}\n\n')));
    const answer = await generate("FAD", [], [], "es", () => {});
    expect(answer.text).toContain("Dato parcial");
    expect(answer.text).toMatch(/incomplet/i);
    expect(isTruncated(answer.text)).toBe(true);
  });
});
