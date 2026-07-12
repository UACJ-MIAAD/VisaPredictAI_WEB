// US E3 (plan auditoría 3 repos, 2026-07-12): portable E2E for responsive,
// keyboard and a11y — replaces the session-local CDP scripts. The suite runs
// against the static export in out/ (same bytes Netlify serves), served by the
// dependency-free server in tests/e2e/static-server.mjs.
//
//   npm run test:e2e        → assumes out/ already exists (fails fast if not)
//   npm run test:e2e:build  → build:offline first, then the suite
//
// One browser (chromium) on purpose: viewports are parametrized per test
// (320…3440), and CI installs only chromium (`playwright install --with-deps
// chromium`). Unit tests stay in vitest (tests/**/*.test.ts — the `.spec.ts`
// suffix here keeps them out of vitest's include glob).
import { defineConfig } from "@playwright/test";

export const E2E_PORT = 4614; // uncommon port — avoids next dev (3000) / vite (5173)

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Static pages are cheap; the heaviest load is the 27k-row panel CSV parse.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `node tests/e2e/static-server.mjs --port ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
