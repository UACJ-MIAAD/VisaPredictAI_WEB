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
    //
    // E1 (cobertura honesta, plan 2026-07-12): denominador COMPLETO sobre TODO
    // lib/ + netlify/functions — el % publicado deja de ser "85% de los 8 módulos
    // que ya testeamos" y pasa a ser el % real sobre toda la lógica. En vitest 4
    // `coverage.include` ya instrumenta TODOS los archivos que matchean aunque
    // ningún test los importe (cuentan al 0%); la opción `all` fue eliminada en v4.
    // Exclusiones documentadas (no son lógica testeable en este runner):
    //  - Componentes React (*.tsx, aquí solo lib/og.tsx — Satori/JSX): el runner es
    //    `environment: "node"` sin DOM ni transform JSX de app; se validan con
    //    typecheck + next build (build-offline en CI), no con vitest.
    //  - lib/content/*.generated.ts: módulos de DATOS auto-generados por
    //    scripts/extract-content.mjs y build-stats.mjs (prosa académica serializada);
    //    meterlos inflaría el denominador con líneas que no son lógica.
    //  - netlify/functions/rag-hashes.json: artefacto de build, no código.
    coverage: {
      provider: "v8",
      include: ["lib/**", "netlify/functions/**"],
      exclude: ["lib/**/*.tsx", "lib/content/*.generated.ts", "**/*.json"],
      // json-summary → coverage/coverage-summary.json: el CI lo usa para publicar
      // el denominador en el job summary y subir el reporte como artefacto.
      reporter: ["text", "html", "json-summary"],
      thresholds: {
        // Pisos GLOBALES = baseline honesta medida 2026-07-12 con este include
        // (209 tests): statements 72.02% (1,187/1,648) · branches 58.90%
        // (860/1,460) · functions 76.98% (291/378) · lines 73.45% (877/1,194).
        // Redondeados hacia abajo (no aspiracionales): rompen si la cobertura CAE,
        // no exigen subirla. Ratchet trimestral: críticos ≥80, core ≥70, global ≥60.
        statements: 70,
        branches: 55,
        functions: 70,
        lines: 70,
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
