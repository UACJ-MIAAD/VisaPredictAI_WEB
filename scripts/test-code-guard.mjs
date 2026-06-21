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

console.log("✓ code-guard: 5/5 passed");
