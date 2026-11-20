// Display-side citation numbering. The agent reserves citation numbers for
// every retrieved chunk (so tool sources never collide with them), which can
// leave an answer whose only citation is "[9]". Readers expect [1], [2], …, so
// the cited sources are renumbered in order of first appearance; uncited
// sources are dropped and bracketed numbers that are not sources stay as is.
import type { Source } from "./types";

export function renumberCitations(content: string, sources: Source[] | undefined): { content: string; sources: Source[] } {
  if (!sources?.length) return { content, sources: [] };
  const byN = new Map(sources.map((s) => [s.n, s]));
  const map = new Map<number, number>();
  for (const m of content.matchAll(/\[(\d+)\]/g)) {
    const n = Number(m[1]);
    if (byN.has(n) && !map.has(n)) map.set(n, map.size + 1);
  }
  const out = content.replace(/\[(\d+)\]/g, (m, d) => {
    const k = map.get(Number(d));
    return k ? `[${k}]` : m;
  });
  const cited = [...map].map(([n, k]) => ({ ...byN.get(n)!, n: k }));
  return { content: out, sources: cited };
}
