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
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { verifyDataMain } from "../lib/data-main-check.mjs";

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
