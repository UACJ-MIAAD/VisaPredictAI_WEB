// Epic E — v0 SDK as design engine. Brief: kill the "dashboard cards" look and
// move to a real editorial / magazine system. Output saved as design notes and
// integrated MANUALLY into the Tailwind/CSS system (never blind-pasted).
import { writeFileSync } from "node:fs";
import { v0 } from "v0-sdk";

if (!process.env.V0_API_KEY) {
  console.error("V0_API_KEY not set — skipping v0 design pass.");
  process.exit(0);
}

const prompt = `Art-direct a New York Times / The Pudding style EDITORIAL redesign
for a long-form academic data-journalism site (Spanish + English, thesis on US
Visa Bulletin prediction). The current design FAILS because every piece of
content is trapped in a bordered "dashboard card" — it looks like a SaaS admin
panel, not a premium magazine.

Give concrete, opinionated direction to fix this:
1) How to present grouped content WITHOUT boxes: hairline rules, generous
   whitespace, baseline grid, typographic hierarchy, lead paragraphs, drop caps,
   pull quotes, marginalia. When (if ever) a card is justified.
2) Type system: serif display (Playfair) + sans (DM Sans) — exact scale ramp,
   measure, leading, weights for h1/h2/h3/lead/body/caption.
3) A restrained accent system around a vivid blue (#0a4da8) + ochre, used
   sparingly. Light AND dark via CSS variables.
4) Layout: max content measure, section rhythm, how stat numbers ("by the
   numbers") should look editorial not widgety, how to render the data-explorer
   charts so they feel like NYT graphics.
5) Mobile-first specifics.

Return tight, implementable CSS/Tailwind guidance (tokens, spacing scale, exact
rules). No placeholder marketing copy.`;

try {
  const res = await v0.chats.create({
    message: prompt,
    modelConfiguration: { modelId: "v0-max" },
  });
  const text =
    res?.text ||
    res?.messages?.map((m) => m.content).join("\n") ||
    JSON.stringify(res, null, 2);
  writeFileSync(
    "content/v0-design-notes.md",
    `# v0 editorial redesign direction\n\n` +
      `v0-sdk · model v0-max · chat: ${res?.webUrl || res?.url || "(n/a)"}\n` +
      `Integrated manually into app/content.css + globals.css.\n\n` +
      "```\n" +
      String(text).slice(0, 9000) +
      "\n```\n",
  );
  console.log("✓ saved → content/v0-design-notes.md · chat:", res?.webUrl || res?.url || "n/a");
} catch (e) {
  console.error("v0 failed (non-fatal):", e?.message || e);
  process.exit(0);
}
