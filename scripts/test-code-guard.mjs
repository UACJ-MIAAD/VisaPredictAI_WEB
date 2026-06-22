// Unit test for the streaming code-block guard in netlify/functions/chat.mjs.
// Runs offline (no key, no network). `npm run guard:test`.
import assert from "node:assert";
import { makeCodeGuard, guardText } from "../netlify/functions/chat.mjs";

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

console.log("✓ code-guard: 15/15 passed");
