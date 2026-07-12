// US I6 (plan auditoría 3 repos): unit tests for the two retrieval-core
// additions — the float16 vector codec (layered index: vectors.f16 must decode
// to the SAME floats the eval monolith carries) and the deterministic temporal
// precedence (a `temporal: "current"` chunk outranks the chunks its
// `supersedes` list names, before the LLM ever sees the context).
import { describe, it, expect } from "vitest";
import {
  f16BitsToF32,
  f32ToF16Bits,
  encodeF16,
  decodeF16,
  buildBM25,
  applyTemporalPrecedence,
  retrieveRanked,
} from "@/lib/visabot/retrieval-core.mjs";

// Portable IEEE-754 half-precision round oracle. f16round is Node 24+ only
// and CI runs Node 22, so the runtime built-in can't be the reference (the
// codec would look "broken" on CI while passing locally). This is a standalone
// round-half-to-even f16 implementation, INDEPENDENT of the code under test, so
// the assertions still pin real f16 semantics rather than becoming tautological.
function f16round(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (!Number.isFinite(x)) return x;
  if (x === 0) return x; // preserves -0
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const MIN_NORMAL = 2 ** -14;
  const MAX_HALF = 65504;
  if (a >= 2 ** 16) return sign * Infinity; // overflow to ±Inf
  let out: number;
  if (a < MIN_NORMAL) {
    // subnormal: quantize to a multiple of 2^-24, round half to even
    const step = 2 ** -24;
    const q = a / step;
    const fl = Math.floor(q);
    const frac = q - fl;
    let r = fl;
    if (frac > 0.5 || (frac === 0.5 && fl % 2 === 1)) r = fl + 1;
    out = r * step;
  } else {
    const e = Math.floor(Math.log2(a));
    const step = 2 ** (e - 10); // 10 mantissa bits
    const q = a / step;
    const fl = Math.floor(q);
    const frac = q - fl;
    let r = fl;
    if (frac > 0.5 || (frac === 0.5 && fl % 2 === 1)) r = fl + 1;
    out = r * step;
    if (out > MAX_HALF) return sign * Infinity;
  }
  return sign * out;
}

describe("float16 codec (layered vectors)", () => {
  it("round-trips exact f16 values", () => {
    for (const x of [0, 1, -1, 0.5, -0.25, 0.099975586, 6.1e-5, -6.1e-5]) {
      expect(f16BitsToF32(f32ToF16Bits(x))).toBe(f16round(x));
    }
  });

  it("agrees with f16round on random unit-interval floats (embedding range)", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    for (let i = 0; i < 2000; i++) {
      const x = rnd();
      expect(f16BitsToF32(f32ToF16Bits(x))).toBe(f16round(x));
    }
  });

  it("handles overflow to ±Infinity and preserves subnormals", () => {
    expect(f16BitsToF32(f32ToF16Bits(70000))).toBe(Infinity); // > f16 max (65504)
    expect(f16BitsToF32(f32ToF16Bits(-70000))).toBe(-Infinity);
    const sub = 3.1e-5; // below f16 normal min (6.1e-5) → subnormal, not zero
    const rt = f16BitsToF32(f32ToF16Bits(sub));
    expect(rt).toBeGreaterThan(0);
    expect(rt).toBe(f16round(sub));
  });

  it("encodeF16 → bytes → decodeF16 is the identity over the round-tripped array", () => {
    const src = new Float32Array([0.1, -0.9, 0.33, 0, 1, -1, 2e-5, 0.7071]);
    const enc = encodeF16(src);
    const bytes = new Uint8Array(enc.buffer, enc.byteOffset, enc.byteLength);
    const dec = decodeF16(bytes) as Float32Array;
    expect(dec.length).toBe(src.length);
    for (let i = 0; i < src.length; i++) expect(dec[i]).toBe(f16round(src[i]));
    // idempotence: encoding the round-tripped values changes nothing
    const dec2 = decodeF16(new Uint8Array(encodeF16(dec).buffer)) as Float32Array;
    expect([...dec2]).toEqual([...dec]);
  });
});

// minimal chunk fixtures — only the fields precedence reads
const H = (id: string, sourceId: string) => ({ id, sourceId }) as never;
const C = (id: string, sourceId: string, supersedes: string[]) =>
  ({ id, sourceId, temporal: "current", supersedes }) as never;

describe("applyTemporalPrecedence (deterministic, rank-only)", () => {
  const chunks = [
    H("h0", "capiv"), // 0 historical (superseded source)
    H("h1", "glosario"), // 1 unrelated
    C("c2", "ingenieria", ["capiii", "capiv", "tablas"]), // 2 current (model card)
    H("h3", "capiii"), // 3 historical (superseded source)
    C("c4", "ingenieria", ["capiv"]), // 4 second current chunk
  ];

  it("is a no-op when nothing current was retrieved", () => {
    expect(applyTemporalPrecedence([0, 1, 3], [0, 1, 3], chunks)).toEqual([0, 1, 3]);
  });

  it("is a no-op when the current chunk already ranks above its victims", () => {
    expect(applyTemporalPrecedence([2, 0, 3], [2, 0, 3], chunks)).toEqual([2, 0, 3]);
  });

  it("lifts a selected current chunk to just above its first superseded victim", () => {
    expect(applyTemporalPrecedence([0, 1, 2], [0, 1, 2], chunks)).toEqual([2, 0, 1]);
  });

  it("swaps a pooled-but-unselected current chunk in, keeping k constant", () => {
    // fused pool saw c2, MMR dropped it while the superseded capiv chunk survived
    const out = applyTemporalPrecedence([0, 1], [0, 1, 2], chunks);
    expect(out).toEqual([2, 0]); // c2 inserted above victim, tail trimmed to k=2
    expect(out.length).toBe(2);
  });

  it("never drops historical chunks that nothing supersedes", () => {
    const out = applyTemporalPrecedence([1, 0, 2], [1, 0, 2], chunks);
    expect(out).toContain(1); // unrelated glossary chunk survives
    expect(out.indexOf(2)).toBeLessThan(out.indexOf(0));
  });

  it("handles several current chunks without ping-ponging", () => {
    const out = applyTemporalPrecedence([0, 2, 4], [2, 4, 0], chunks);
    expect(out.indexOf(2)).toBeLessThan(out.indexOf(0));
    expect(out.indexOf(4)).toBeLessThan(out.indexOf(0));
    expect(out.length).toBe(3);
  });
});

describe("retrieveRanked applies temporal precedence end-to-end (BM25-only path)", () => {
  it("ranks the current results chunk above the frozen proposal it supersedes", () => {
    const chunks = [
      {
        id: "plan", lang: "es", sourceId: "capiv", title: "Metodología",
        text: "entrenamiento de los modelos planteados modelos comparados modelos comparados en la propuesta",
      },
      {
        id: "card", lang: "es", sourceId: "ingenieria", title: "Model card",
        temporal: "current", supersedes: ["capiii", "capiv", "tablas"],
        text: "modelos comparados resultados ejecutados campeón desplegado",
      },
      { id: "other", lang: "es", sourceId: "glosario", title: "FAD", text: "final action dates definición" },
    ] as never[];
    const bm25 = buildBM25(chunks);
    const { selected } = retrieveRanked({
      chunks, vectors: new Float32Array(0), dim: 0, bm25,
      query: "modelos comparados", qv: null, lang: "es", k: 3,
    });
    const pos = (id: string) => selected.findIndex((i: number) => (chunks[i] as { id: string }).id === id);
    expect(pos("card")).toBeGreaterThanOrEqual(0);
    expect(pos("plan")).toBeGreaterThanOrEqual(0); // history retrievable, not erased
    expect(pos("card")).toBeLessThan(pos("plan")); // …but the executed results outrank it
  });
});
