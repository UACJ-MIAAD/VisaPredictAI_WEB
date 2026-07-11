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
    // G3 (plan auditoría 2026-07-11): cobertura instrumentada desde cero, con PISOS
    // por área crítica (no un promedio que esconda módulos): el loader/manifiesto
    // (lib/release), la recuperación del bot (retrieval-core), los builders de
    // charts/galería y los helpers de datos que la suite ya cubre. Los pisos solo
    // SUBEN editando esta config (trinquete explícito en PR).
    coverage: {
      provider: "v8",
      include: [
        "lib/release.mjs",
        "lib/repo.mjs",
        "lib/visabot/retrieval-core.mjs",
        "lib/visabot/analytics.ts",
        "lib/visabot/gallery.ts",
        "lib/data/panel-core.ts",
        "lib/data/eda-derive.ts",
        "lib/site-map.ts",
      ],
      thresholds: {
        "lib/release.mjs": { statements: 90 },
        "lib/visabot/retrieval-core.mjs": { statements: 60 },
        "lib/visabot/analytics.ts": { statements: 70 },
        "lib/data/panel-core.ts": { statements: 88 },
        "lib/visabot/gallery.ts": { statements: 80 },
        "lib/data/eda-derive.ts": { statements: 90 },
        "lib/site-map.ts": { statements: 60 },
      },
    },
  },
});
