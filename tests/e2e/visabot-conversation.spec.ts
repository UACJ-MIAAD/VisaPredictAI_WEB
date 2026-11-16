import { test, expect } from "@playwright/test";
import { blockExternal } from "./helpers";

for (const lang of ["es", "en"] as const) {
  test(`VisaBot ${lang}: country, table and category survive a four-turn conversation`, async ({ page, context }) => {
    await blockExternal(context);
    const requests: { synthetics?: {kind: string; country: string; category: string; table: string}[] }[] = [];
    await page.route("**/.netlify/functions/chat", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ contentType: "text/event-stream", body: 'data: {"t":"sources","sources":[]}\n\ndata: {"t":"delta","text":"Respuesta de prueba."}\n\ndata: {"t":"done"}\n\n' });
    });
    await page.goto(lang === "en" ? "/en/asistente/" : "/asistente/");
    // The console loads the verified panel asynchronously; wait for its chart
    // tools to be ready before asking for a forecast.
    await expect(page.locator("textarea")).toBeVisible();
    await expect(page.locator('[title="country × category × table"], [title="país × categoría × tabla"]').first()).toBeAttached();
    const turns = lang === "es"
      ? ["Pronóstico México F2A FAD", "¿y India?", "¿y DFF?", "¿y F1?"]
      : ["Mexico F2A FAD forecast", "and India?", "and DFF?", "and F1?"];
    for (let i = 0; i < turns.length; i++) {
      const input = page.locator("textarea");
      await input.fill(turns[i]);
      await input.press("Enter");
      await expect.poll(() => requests.length).toBe(i + 1);
      await expect(page.getByRole("button", { name: lang === "es" ? "Enviar" : "Send", exact: true })).toBeVisible();
      expect(requests[i].synthetics?.[0]).toMatchObject({kind: "forecast_note", country: i ? "india" : "mexico", category: i === 3 ? "F1" : "F2A", table: i >= 2 ? "DFF" : "FAD"});
    }
  });

  test(`VisaBot ${lang}: stopping during retrieval sends no later chat request`, async ({ page, context }) => {
    await blockExternal(context);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/rag/chunks.json", async route => { await gate; await route.continue(); });
    let sent = 0;
    await page.route("**/.netlify/functions/chat", async route => { sent++; await route.abort(); });
    await page.goto(lang === "en" ? "/en/asistente/" : "/asistente/");
    await page.locator("textarea").fill("What is FAD?");
    await page.locator("textarea").press("Enter");
    await page.getByRole("button", { name: lang === "es" ? "Detener" : "Stop", exact: true }).click();
    release();
    // A second turn must be the only request after the paused download resolves.
    await page.locator("textarea").fill("What is DFF?");
    await page.locator("textarea").press("Enter");
    await expect.poll(() => sent).toBe(1);
    await expect(page.getByRole("button", {name: lang === "es" ? "Enviar" : "Send", exact: true})).toBeVisible();
    expect(sent).toBe(1);
  });
}
