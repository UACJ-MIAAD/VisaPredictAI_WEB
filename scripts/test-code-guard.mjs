// Unit test for the streaming code-block guard in netlify/functions/chat.mjs.
// Runs offline (no key, no network). `npm run guard:test`.
import assert from "node:assert";
import { makeCodeGuard, guardText, makeEmojiStripper } from "../netlify/functions/chat.mjs";

const run = (deltas, lang = "es") => {
  const g = makeCodeGuard(lang);
  let out = "";
  for (const d of deltas) out += g.push(d);
  out += g.flush();
  return { out, blocked: g.blocked };
};

// 1) clean prose passes through unchanged (held tail is flushed)
{
  const { out, blocked } = run(["México ", "F2A avanza ", "~640 días/año."]);
  assert.equal(blocked, false);
  assert.equal(out, "México F2A avanza ~640 días/año.");
}

// 2) inline single backticks are fine (not a fence)
{
  const { out, blocked } = run(["La categoría `F2A` ", "es válida."]);
  assert.equal(blocked, false);
  assert.equal(out, "La categoría `F2A` es válida.");
}

// 3) a fenced block is cut: clean prefix kept, refusal appended, code dropped
{
  const { out, blocked } = run(["Claro:\n", "```python\nprint('x')\n```\nlisto"]);
  assert.equal(blocked, true);
  assert.ok(out.startsWith("Claro:\n"), "keeps clean prefix");
  assert.ok(!out.includes("print('x')"), "drops the code");
  assert.ok(out.includes(guardText("es")), "appends the refusal");
}

// 4) fence split across deltas char-by-char is still caught
{
  const { out, blocked } = run(["antes ", "`", "`", "`", "js\ncode();"]);
  assert.equal(blocked, true);
  assert.ok(out.startsWith("antes "));
  assert.ok(!out.includes("code()"), "drops code even when fence is split");
}

// 5) fence forming exactly at a delta boundary (`` + `)
{
  const { out, blocked } = run(["x``", "`alert(1)"]);
  assert.equal(blocked, true);
  assert.ok(!out.includes("alert"), "drops code when the fence completes at the boundary");
}

// 6) TILDE fence (~~~) — the audit bypass — is now caught
{
  const { out, blocked } = run(["sure:\n", "~~~python\nimport os\n~~~"]);
  assert.equal(blocked, true);
  assert.ok(out.startsWith("sure:\n") && !out.includes("import os"), "drops ~~~ tilde-fenced code");
}

// 7) raw HTML <pre><code> — the audit bypass — is now caught (case-insensitive)
{
  const { out, blocked } = run(["here ", "<PRE><code>alert(2)</code></pre>"]);
  assert.equal(blocked, true);
  assert.ok(!out.includes("alert"), "drops <pre> HTML code block");
}

// 8) bare <code> HTML is caught
{
  const { out, blocked } = run(["x <code>danger()</code>"]);
  assert.equal(blocked, true);
  assert.ok(!out.includes("danger"), "drops <code> HTML");
}

// 9) the <code marker split across deltas (`<co` + `de>`) is still caught
{
  const { out, blocked } = run(["a <co", "de>boom()</code>"]);
  assert.equal(blocked, true);
  assert.ok(!out.includes("boom"), "catches <code split across deltas");
}

// 10) prose that merely MENTIONS code words (no fence/marker) passes untouched
{
  const { out, blocked } = run(["El método ", "SARIMA ajusta la serie."]);
  assert.equal(blocked, false);
  assert.equal(out, "El método SARIMA ajusta la serie.");
}

// --- markerless code (the audit-found bypasses: no fence, no <pre>/<code>) ---

// 11) a 4-space-indented code block (no fence) is now caught, neither line leaks
{
  const { out, blocked } = run(["Mira:\n", "    def hack():\n        return 1\nfin"]);
  assert.equal(blocked, true);
  assert.ok(out.startsWith("Mira:\n"), "keeps clean prefix");
  assert.ok(!out.includes("def hack") && !out.includes("return 1"), "drops indented code");
  assert.ok(out.includes(guardText("es")), "appends refusal");
}

// 12) a markerless def/class block (code keyword + punctuation) is caught
{
  const { out, blocked } = run(["claro\n", "function f(x) {\n  return x * 2;\n}"]);
  assert.equal(blocked, true);
  assert.ok(!out.includes("return x") && !out.includes("function f"), "drops markerless code");
}

// 13) a numbered list whose items are code lines is caught
{
  const { out, blocked } = run(["1. import os\n2. def f(x):\n3. return x\n"]);
  assert.equal(blocked, true);
  assert.ok(!out.includes("def f"), "drops line-by-line code disguised as a list");
}

// 14) a REAL markdown table is NOT a false positive
{
  const md = "Estado:\n| Cat | MX |\n| --- | --- |\n| F2A | C |\n";
  const { out, blocked } = run([md]);
  assert.equal(blocked, false, "markdown table must not trip the heuristic");
  assert.ok(out.includes("| F2A | C |"), "table survives");
}

// 15) a normal bullet/prose answer with parentheses is NOT a false positive
{
  const md = "Para México (F2A):\n- La fecha avanza.\n- Consulta el boletín oficial.\n";
  const { out, blocked } = run([md]);
  assert.equal(blocked, false, "ordinary prose with () must pass");
  assert.ok(out.includes("Consulta el boletín oficial."), "prose survives");
}

// 16) Model-Confidence-Set notation must NOT trip the code guard: two
// consecutive lines ending in `}` cut the flagship answer mid-stream (audit r2)
{
  const { out, blocked } = run(["- FAD = {naive1}\n", "- DFF = {naive1}\n", "según Friedman–Nemenyi."]);
  assert.equal(blocked, false, "set notation blocked");
  assert.ok(out.includes("{naive1}"), "set notation emitted");
}

// 17) …but real code lines ending in braces still block
{
  const { blocked } = run(["function f() {\n", "  return 1; }\n", "listo"]);
  assert.equal(blocked, true, "real code not blocked");
}

// 18) the set-notation exemption is TIGHT: `}`-ending lines with code
// punctuation inside the braces (`{ foo(); }`, `{ print(i); }`) are still code —
// two consecutive block. With the old over-broad exemption both would be
// exempted and slip through (audit r3 over-broad-exemption).
{
  const { blocked } = run(["Ejemplo:\n", "if (a) { foo(); }\n", "for (i in x) { print(i); }\n", "fin"]);
  assert.equal(blocked, true, "consecutive brace lines with code punctuation not blocked");
}

// 19) …while a set with a comma and a space stays prose (e.g. `{ETS, Theta}`).
{
  const { out, blocked } = run(["El MCS al 90 % = {ETS, Theta}\n", "según el ranking."]);
  assert.equal(blocked, false, "comma set notation blocked");
  assert.ok(out.includes("{ETS, Theta}"), "comma set notation emitted");
}

// 20) a NESTED markdown list (sub-items indented ≥4 spaces) must NOT be treated
// as an indented code block — two consecutive sub-items used to trip the guard
// and cut the answer (indent-vs-list false positive).
{
  const md = "Opciones:\n- México:\n    - F2A avanza.\n    - F4 retrocede.\nEso es todo.";
  const { out, blocked } = run([md]);
  assert.equal(blocked, false, "nested markdown list must not trip the guard");
  assert.ok(out.includes("F2A avanza.") && out.includes("F4 retrocede."), "nested items survive");
}

// 21) sentence-final "console." / "System." (domain prose) must NOT block: the
// /asistente surface is literally "the console" (finding 3).
{
  const { out, blocked } = run(["Abre el asistente console.\n", "El console. Muestra los gráficos.\n", "listo"]);
  assert.equal(blocked, false, "domain word 'console.' must not be code");
  assert.ok(out.includes("Muestra los gráficos."), "console prose survives");
}
{
  const { out, blocked } = run(["Open the assistant console.\n", "The console. It renders charts.\n"], "en");
  assert.equal(blocked, false, "English 'console.' prose must not block");
  assert.ok(out.includes("It renders charts."), "english console prose survives");
}

// 22) …but a real console.log() call is still code (2 lines block).
{
  const { blocked } = run(["debug:\n", "console.log(x);\n", "console.log(y);\n", "fin"]);
  assert.equal(blocked, true, "console.log() calls still blocked");
}

// 23) a LONE shebang / <?php / <!DOCTYPE now blocks on a single line (finding 4:
// the 2-consecutive rule let one such line through between prose).
{
  const { out, blocked } = run(["Ejecuta esto:\n", "#!/bin/bash\n", "y ya."]);
  assert.equal(blocked, true, "lone shebang blocks");
  assert.ok(out.startsWith("Ejecuta esto:\n") && !out.includes("bin/bash"), "drops the shebang line");
}
{
  const { blocked } = run(["antes\n", "<?php echo 1;\n"]);
  assert.equal(blocked, true, "lone <?php blocks");
}

// 24) a CREATE TABLE mentioned in ordinary prose must NOT hard-block (the site
// legitimately explains the star schema) — only unambiguous shebang/php/doctype.
{
  const { out, blocked } = run(["La tabla dim_category se define con CREATE TABLE en el esquema.\n", "Tiene 7 columnas."]);
  assert.equal(blocked, false, "prose mentioning CREATE TABLE must not hard-block");
  assert.ok(out.includes("Tiene 7 columnas."), "schema prose survives");
}

// 25) obfuscation: a fence with leading indentation is still caught
{
  const { blocked } = run(["mira:\n", "   ```python\nprint(1)\n```"]);
  assert.equal(blocked, true, "indented fence caught");
}

// 26) obfuscation: <pre> with attributes is caught
{
  const { out, blocked } = run(['aquí <pre class="lang-js">code()</pre>']);
  assert.equal(blocked, true, "<pre> with attributes caught");
  assert.ok(!out.includes("code()"), "drops the code");
}

// 27) obfuscation: a ~~~ fence carrying a language tag + minified JS is caught
{
  const { blocked } = run(["ok\n", "~~~javascript\nfunction f(){return 1}\n~~~"]);
  assert.equal(blocked, true, "~~~ minified caught");
}

// 28) code smuggled as indented markdown bullets IS caught (bare keyword + identifier)
{
  const { out, blocked } = run(["Aquí:\n", "    - import os\n    - return secret\nfin"]);
  assert.equal(blocked, true, "bulleted code smuggling blocked");
  assert.ok(!out.includes("import os") && !out.includes("return secret"), "drops the smuggled code");
}

// 29) …but prose bullets ("- From Mexico", "- from 2020") are NOT flagged
{
  const { out, blocked } = run(["Comparación:\n", "- From Mexico the wait grows\n- from 2020 onwards it changed\nlisto"]);
  assert.equal(blocked, false, "prose bullets must not be code");
  assert.ok(out.includes("From Mexico the wait grows"), "prose bullet survives");
}

console.log("✓ code-guard: 29 groups passed");

// ── emoji stripper (a serious RAG must never emit emojis) ───────────────────
{
  const strip = makeEmojiStripper();
  const out = strip("📊 Pronóstico 📅 de México ❓ ✅ 👋 🔍 listo");
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u.test(out), "all emojis removed");
  assert.ok(out.includes("Pronóstico") && out.includes("de México") && out.includes("listo"), "prose preserved");
}
{
  // legitimate arrows/shapes the assistant uses in tables must survive
  const strip = makeEmojiStripper();
  const out = strip("FAD → DFF · ↔ desliza · ▲ +30 d · ▼ -14 d");
  assert.ok(out.includes("→") && out.includes("↔") && out.includes("▲") && out.includes("▼"), "arrows/shapes preserved");
}
{
  // a surrogate-pair emoji (📊 = 📊) split across two deltas is still removed
  const strip = makeEmojiStripper();
  const out = strip("dato \uD83D") + strip("\uDCCA fin");
  assert.ok(!out.includes("\uDCCA") && !out.includes("\uD83D"), "split emoji removed");
  assert.ok(out.includes("dato ") && out.includes(" fin"), "surrounding text kept");
}
console.log("✓ emoji-stripper: 3 groups passed");
