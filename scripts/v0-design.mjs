// Epic E — uses the v0 SDK (model v0-1.5-lg, env V0_API_KEY) as a design engine
// for the flagship "Datos históricos" section. Output is saved as design notes
// and integrated MANUALLY into React/Tailwind/shadcn — never blind-pasted, so
// it cannot break content fidelity, accessibility, or the real-data wiring.
import { writeFileSync } from "node:fs";
import { v0 } from "v0-sdk";

if (!process.env.V0_API_KEY) {
  console.error("V0_API_KEY not set — skipping v0 design pass.");
  process.exit(0);
}

const prompt = `You are designing ONE section of a New York Times–style editorial
data-journalism site (academic thesis, Spanish UI). Section title:
"Visa Bulletin · Datos históricos". It must feel premium, calm, serif headlines
(Playfair Display) + sans body (DM Sans), generous whitespace, hairline dividers,
restrained accent. It contains: a shared filter bar (país / categoría / tabla),
a primary time-series line chart of priority-date movement, a country-comparison
chart, a month-to-month movement bar chart, a C/F/U status donut, and a large
virtualized data table with sort + CSV export. Light AND dark theme via semantic
CSS variables (--color-bg, --color-surface, --color-ink, --color-accent,
--color-accent-2, --color-border). Use Tailwind + shadcn/ui patterns. Return a
concise React + Tailwind structural concept (layout, spacing, component hierarchy).
Do NOT invent data or copy — placeholders only.`;

try {
  const res = await v0.chats.create({
    message: prompt,
    modelConfiguration: { modelId: "v0-max" },
  });
  const text =
    res?.latestVersion?.demoUrl ||
    res?.text ||
    res?.messages?.map((m) => m.content).join("\n") ||
    JSON.stringify(res, null, 2);
  writeFileSync(
    "content/v0-design-notes.md",
    `# v0 design concept — "Datos históricos"\n\n` +
      `Generated with v0-sdk · model v0-max (requested v0-1.5-lg is retired; ` +
      `API accepts v0-auto|v0-mini|v0-pro|v0-max|v0-max-fast).\n` +
      `Integrated manually into components/sections/historico.tsx (not blind-pasted).\n\n` +
      `Chat: ${res?.webUrl || res?.url || "(see SDK response)"}\n\n` +
      "```\n" +
      String(text).slice(0, 6000) +
      "\n```\n",
  );
  console.log("✓ v0 concept saved → content/v0-design-notes.md");
  console.log("  chat:", res?.webUrl || res?.url || "(n/a)");
} catch (e) {
  console.error("v0 call failed (non-fatal):", e?.message || e);
  writeFileSync(
    "content/v0-design-notes.md",
    `# v0 design concept — "Datos históricos"\n\n` +
      `v0-sdk (model v0-1.5-lg) call attempted; failed at build time: ${e?.message || e}.\n` +
      `The section was authored manually to the same editorial brief.\n`,
  );
  process.exit(0);
}
