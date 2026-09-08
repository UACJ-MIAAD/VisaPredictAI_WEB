/**
 * F7-R3 · `dataMain` se comprueba contra el repositorio de datos real, no contra sí mismo.
 *
 * El puntero se quedó congelado tres squashes seguidos: los reemplazos que debían moverlo no
 * coincidían, `str.replace` no falla al no encontrar nada, y la prueba que lo fijaba afirmaba el
 * MISMO valor rancio. Verde sobre una mentira consistente. Aquí la verificación se hace contra
 * `origin/main` de un checkout de datos, con igualdad exacta, y la evidencia de cada historia debe
 * resolver y ser ancestro o igual a ese main. Nada se descarga: se opera sobre repos de juguete.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  DATA_MAIN_REF,
  DATA_REPO_URL,
  LS_REMOTE_TIMEOUT_MS,
  parseLsRemote,
  readDeclaredDataMain,
  verifyAgainstRemote,
  verifyDataMain,
} from "../lib/data-main-check.mjs";

function repoDeJuguete(): { dir: string; commits: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "datos-"));
  const run = (args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
  execFileSync("git", ["init", "-q", dir]);
  run(["config", "user.email", "t@t"]);
  run(["config", "user.name", "t"]);
  const commits: string[] = [];
  for (const n of [1, 2, 3]) {
    writeFileSync(join(dir, `f${n}.txt`), String(n));
    run(["add", "-A"]);
    run(["commit", "-qm", `c${n}`]);
    commits.push(run(["rev-parse", "HEAD"]));
  }
  // `origin/main` sin remoto real: una referencia local que apunta a la punta.
  run(["update-ref", "refs/remotes/origin/main", commits[2]]);
  return { dir, commits };
}

const gitDe = (dir: string) => (args: string[]) => {
  try {
    return execFileSync("git", ["-C", dir, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

describe("the pointer is checked against the real repository", () => {
  it("accepts the exact SHA of origin/main", () => {
    const { dir, commits } = repoDeJuguete();
    expect(verifyDataMain(gitDe(dir), commits[2], [])).toEqual([]);
  });

  it("rejects a stale pointer, naming both sides", () => {
    const { dir, commits } = repoDeJuguete();
    const problemas = verifyDataMain(gitDe(dir), commits[0], []);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/rancio/);
    expect(problemas[0]).toContain(commits[0].slice(0, 12));
    expect(problemas[0]).toContain(commits[2].slice(0, 12));
  });

  it("accepts a valid maintenance advance: main moves and the pointer follows", () => {
    const { dir, commits } = repoDeJuguete();
    const run = (args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
    writeFileSync(join(dir, "mantenimiento.txt"), "x");
    run(["add", "-A"]);
    run(["commit", "-qm", "mantenimiento"]);
    const nuevo = run(["rev-parse", "HEAD"]);
    run(["update-ref", "refs/remotes/origin/main", nuevo]);
    // La evidencia vieja sigue siendo válida: es ancestro del nuevo main.
    expect(verifyDataMain(gitDe(dir), nuevo, [{ id: "F7", evidence: commits[1].slice(0, 7) }])).toEqual([]);
    // Y el puntero viejo ya no pasa.
    expect(verifyDataMain(gitDe(dir), commits[2], [])).toHaveLength(1);
  });

  it.each([
    ["corta", "1c81b6f"],
    ["vacía", ""],
    ["no hexadecimal", "z".repeat(40)],
  ])("rejects a dataMain that is %s", (_caso, valor) => {
    const { dir } = repoDeJuguete();
    expect(verifyDataMain(gitDe(dir), valor, [])[0]).toMatch(/sha completo/);
  });

  it("fails when the data repository cannot be read, instead of passing", () => {
    const problemas = verifyDataMain(() => null, "0".repeat(40), []);
    expect(problemas[0]).toMatch(/no se pudo leer origin\/main/);
  });
});

describe("story evidence must resolve and be an ancestor", () => {
  it("accepts evidence that is an ancestor of the declared main", () => {
    const { dir, commits } = repoDeJuguete();
    const historias = [
      { id: "F7", evidence: commits[1].slice(0, 7) },
      { id: "F8", evidence: commits[2].slice(0, 7) },
    ];
    expect(verifyDataMain(gitDe(dir), commits[2], historias)).toEqual([]);
  });

  it("rejects evidence that does not resolve in the repository", () => {
    const { dir, commits } = repoDeJuguete();
    const problemas = verifyDataMain(gitDe(dir), commits[2], [{ id: "F7", evidence: "abcdef0" }]);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/F7.*no resuelve/);
  });

  it("ignores evidence that is not a commit, without inventing a failure", () => {
    const { dir, commits } = repoDeJuguete();
    // Control benigno: las historias del repo web no citan commit de datos.
    expect(verifyDataMain(gitDe(dir), commits[2], [{ id: "F1" }, { id: "B4", evidence: undefined }])).toEqual([]);
  });

  it("keeps the trailing note of an observing story out of the way", () => {
    const { dir, commits } = repoDeJuguete();
    const historias = [{ id: "F5", evidence: `${commits[1].slice(0, 7)} · reglas puestas; los facts esperan` }];
    expect(verifyDataMain(gitDe(dir), commits[2], historias)).toEqual([]);
  });
});


describe("the remote pointer check is one bounded query, and hermetic in tests", () => {
  const SHA = "1c81b6fd57ae74429c75d294b3e5caef91ac782b";
  const linea = (sha = SHA, ref = DATA_MAIN_REF) => `${sha}\t${ref}\n`;

  it("asks exactly once, with a constant URL, a constant ref and a bounded timeout", () => {
    const llamadas: Array<{ url: string; ref: string; timeoutMs: number }> = [];
    const runner = (args: { url: string; ref: string; timeoutMs: number }) => {
      llamadas.push(args);
      return linea();
    };
    expect(verifyAgainstRemote(runner, SHA)).toEqual([]);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe(DATA_REPO_URL);
    expect(llamadas[0].ref).toBe(DATA_MAIN_REF);
    expect(llamadas[0].timeoutMs).toBe(LS_REMOTE_TIMEOUT_MS);
    expect(LS_REMOTE_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("no test touches the network: the executor is injected", () => {
    const fuente = readFileSync(new URL("./data-main-check.test.ts", import.meta.url), "utf8");
    expect(fuente).not.toMatch(/execFileSync\(\s*"git",\s*\[\s*"ls-remote"/);
  });

  it("accepts the exact SHA of the remote main", () => {
    expect(verifyAgainstRemote(() => linea(), SHA)).toEqual([]);
  });

  it("rejects a stale pointer, naming both sides", () => {
    const viejo = "17eb7a9593d512387dcb6babb60549deecdd3ab8";
    const problemas = verifyAgainstRemote(() => linea(), viejo);
    expect(problemas).toHaveLength(1);
    expect(problemas[0]).toMatch(/rancio/);
    expect(problemas[0]).toContain(viejo.slice(0, 12));
    expect(problemas[0]).toContain(SHA.slice(0, 12));
  });

  it("accepts a maintenance advance once the pointer follows", () => {
    const nuevo = "0123456789abcdef0123456789abcdef01234567";
    expect(verifyAgainstRemote(() => linea(nuevo), nuevo)).toEqual([]);
    // …y el puntero anterior deja de valer en cuanto el main avanza.
    expect(verifyAgainstRemote(() => linea(nuevo), SHA)).toHaveLength(1);
  });

  it.each([
    ["timeout", () => { throw new Error("ETIMEDOUT"); }],
    ["fallo del proceso", () => { throw new Error("git murió"); }],
  ])("fails closed on %s", (_caso, runner) => {
    expect(verifyAgainstRemote(runner as () => string, SHA)[0]).toMatch(/ls-remote falló/);
  });

  it.each([
    ["vacía", ""],
    ["solo espacios", "   \n"],
    ["duplicada", linea() + linea("0".repeat(40))],
    ["mal formada", "solo-un-campo\n"],
    ["sha inválido", `zzzz\t${DATA_MAIN_REF}\n`],
    ["otra ref", linea(SHA, "refs/heads/otra")],
  ])("fails closed on a %s response", (_caso, salida) => {
    expect(() => parseLsRemote(salida as string)).toThrow();
    expect(verifyAgainstRemote(() => salida as string, SHA)).toHaveLength(1);
  });

  it.each(["1c81b6f", "", "z".repeat(40)])("refuses a declared pointer that is %s", (valor) => {
    expect(verifyAgainstRemote(() => linea(), valor)[0]).toMatch(/sha completo/);
  });
});

describe("the declared pointer is read from the plan, fail-closed", () => {
  it("reads a well-formed pointer", () => {
    expect(readDeclaredDataMain('dataMain: "1c81b6fd57ae74429c75d294b3e5caef91ac782b",')).toBe(
      "1c81b6fd57ae74429c75d294b3e5caef91ac782b",
    );
  });

  it.each([
    ["sin dataMain", "export const PLAN_META = {};"],
    ["corto", 'dataMain: "1c81b6f",'],
    ["vacío", 'dataMain: "",'],
  ])("throws on a plan %s", (_caso, texto) => {
    expect(() => readDeclaredDataMain(texto)).toThrow();
  });

  it("reads the real plan and matches PLAN_META", async () => {
    const { PLAN_META } = await import("../lib/plan-data");
    const texto = readFileSync(new URL("../lib/plan-data.ts", import.meta.url), "utf8");
    expect(readDeclaredDataMain(texto)).toBe(PLAN_META.dataMain);
  });
});
