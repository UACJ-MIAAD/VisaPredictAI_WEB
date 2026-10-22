// Server component: stability cohorts of the served cut (/ingenieria#cohortes, E5). Every
// number comes from public/data/e5_facts.json, fetched at build from the data repo and verified
// against the release manifest; the copy is built by `cohortSurface`, the same function that
// feeds the assistant's chunks, so the page and VisaBot cannot drift apart. A cut without the
// artifact renders only the anchor; a malformed one throws and stops the build, because a
// number that cannot be validated must never reach the page.

import fs from "node:fs";
import path from "node:path";
import { cohortSurface, readCohortFacts } from "@/lib/data/cohort-facts.mjs";
import type { Lang } from "@/lib/site-map";

function loadFacts() {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(process.cwd(), "public", "data", "e5_facts.json"), "utf8");
  } catch {
    return null;
  }
  return readCohortFacts(JSON.parse(raw));
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[8rem] flex-1">
      <div className="font-serif text-3xl font-bold text-[var(--color-ink)]">{value}</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

export function Cohortes({ lang, className }: { lang: Lang; className?: string }) {
  const s = cohortSurface(loadFacts(), lang);
  // the #cohortes anchor must exist even without the artifact: the nav TOC targets it.
  if (!s) return <section id="cohortes" aria-hidden="true" />;
  return (
    <section id="cohortes" className={className ?? "section"} aria-labelledby="cohortes-title">
      <div className="section-inner">
        <span className="section-tag">{s.eyebrow}</span>
        <h2 id="cohortes-title" className="section-title">
          {s.title}
        </h2>
        <p className="section-sub">{s.intro}</p>

        <div className="flex flex-wrap gap-x-10 gap-y-6 border-t-2 border-[var(--color-rule)] pt-5">
          {s.stats.map((x) => (
            <Stat key={x.label} value={x.value} label={x.label} />
          ))}
        </div>

        <div className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2 [&>div]:min-w-0">
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-rule)] text-left text-[var(--color-muted)]">
                  {s.tableHead.map((h, i) => (
                    <th key={h} scope="col" className={i === 0 ? "py-2 font-medium" : "py-2 text-right font-medium"}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.byTable.map((r) => (
                  <tr key={r.table} className="border-b border-[var(--color-border)]">
                    <th scope="row" className="py-2 text-left font-semibold text-[var(--color-ink)]">
                      {r.table}
                    </th>
                    <td className="py-2 text-right tabular-nums">{r.stable}</td>
                    <td className="py-2 text-right tabular-nums">{r.unstable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-3 text-sm leading-relaxed text-[var(--color-ink)]">
            {s.findings.map((f) => (
              <li key={f} className="border-l-2 border-[var(--color-rule)] pl-3">
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 max-w-3xl text-sm text-[var(--color-muted)]">
          <strong className="font-semibold text-[var(--color-ink)]">
            {s.statusLabel}: {s.status}.
          </strong>{" "}
          {s.statusNote}
        </p>
      </div>
    </section>
  );
}
