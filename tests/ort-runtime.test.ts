import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertOrtRuntimeVersion, ORT_RUNTIME_PREFIX, ORT_RUNTIME_VERSION } from "../lib/ort-runtime.mjs";

describe("the immutable browser runtime assets", () => {
  it("matches the exact web runtime installed by the lock", () => {
    const installed = JSON.parse(readFileSync("node_modules/onnxruntime-web/package.json", "utf8")).version;
    expect(() => assertOrtRuntimeVersion(installed)).not.toThrow();
    expect(() => assertOrtRuntimeVersion("another revision")).toThrow(/revision differs/);
  });

  it.each(["https://visapredictai.com", "http://127.0.0.1:8080"])("keeps both versioned assets on %s", (origin) => {
    for (const extension of ["mjs", "wasm"]) {
      const url = new URL(`${ORT_RUNTIME_PREFIX}ort-wasm-simd-threaded.asyncify.${extension}`, origin);
      expect(url.origin).toBe(origin);
      expect(url.pathname).toContain(`/${ORT_RUNTIME_VERSION}/`);
      expect(url.pathname).not.toBe(`/ort/ort-wasm-simd-threaded.asyncify.${extension}`);
    }
  });

});
