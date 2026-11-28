"use client";

import { useState } from "react";
import type { ArticleModel } from "@/lib/article/article-copy.mjs";
import styles from "./article.module.css";

// Ejemplos trabajados del manuscrito (último boletín del panel, FAD). Probabilidades de la
// mezcla a 1/3/5 años (evaluadas) y escenario de la simulación a 5/10/20/30 años (no validado).

export function ExampleExplorer({ m }: { m: ArticleModel }) {
  const es = m.lang === "es";
  const [id, setId] = useState(m.examples[0].id);
  const e = m.examples.find((x) => x.id === id) ?? m.examples[0];
  const yrs = (k: number) => (es ? `${k} ${k === 1 ? "año" : "años"}` : `${k} ${k === 1 ? "year" : "years"}`);

  return (
    <div className={styles.explorer}>
      <div className={styles.tabs} role="tablist" aria-label={es ? "Ejemplos" : "Examples"}>
        {m.examples.map((x) => (
          <button key={x.id} role="tab" type="button" aria-selected={x.id === id} id={`tab-${x.id}`}
            aria-controls="example-panel" className={styles.tab} onClick={() => setId(x.id)}>
            <span className={styles.tabName}>{x.name}</span>
            <span className={styles.tabSub}>{es ? "prioridad:" : "priority date:"} {x.pd}</span>
          </button>
        ))}
      </div>
      <div id="example-panel" role="tabpanel" aria-labelledby={`tab-${e.id}`} className={styles.exPanel}>
        <dl className={styles.exFacts}>
          <div><dt>{m.cutLabel}</dt><dd>{e.cut}</dd></div>
          <div><dt>{es ? "Fecha de prioridad" : "Priority date"}</dt><dd>{e.pd}</dd></div>
          <div><dt>{es ? "Brecha" : "Gap"}</dt><dd>{e.gap} {es ? "años" : "years"}</dd></div>
          <div><dt>{es ? "Mediana del escenario" : "Scenario median"}</dt><dd>{e.median}</dd></div>
        </dl>

        <div className={styles.exCols}>
          <div>
            <h4 className={styles.exHead}>{es ? "Probabilidad evaluada (combinación)" : "Evaluated probability (blend)"}</h4>
            {e.evaluated ? (
              <ul className={styles.bars}>
                {e.blend.map((b) => (
                  <li key={b.k}>
                    <span className={styles.barLabel}>{yrs(b.k)}</span>
                    <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${Math.max(b.value, 0.6)}%` }} /></span>
                    <span className={styles.barVal}>{b.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.outside}>{m.sections.ejemplos.outside}</p>
            )}
          </div>
          <div>
            <h4 className={styles.exHead}>{es ? "Escenario de la simulación (no validado)" : "Simulation scenario (not validated)"}</h4>
            <ul className={styles.bars}>
              {e.scenario.map((s) => (
                <li key={s.years}>
                  <span className={styles.barLabel}>{yrs(s.years)}</span>
                  <span className={styles.barTrack}><span className={styles.barScenario} style={{ width: `${Math.max(s.value, 0.6)}%` }} /></span>
                  <span className={styles.barVal}>{s.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className={styles.exNote}>
          {es
            ? "Probabilidad de quedar vigente dentro de cada plazo. Las barras rayadas son escenarios: el panel no puede validar esperas de más de cinco años."
            : "Probability of becoming current within each horizon. Hatched bars are scenarios: the panel cannot validate waits beyond five years."}
        </p>
      </div>
    </div>
  );
}
