// Minimal unit-test config (BC1). Node environment, no DOM: the suite covers
// only pure modules (parsers, path helpers, analytics math, type guards).
// The "@/" alias replicates tsconfig.json's paths ("@/*" → "./*").
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": dirname(fileURLToPath(import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
