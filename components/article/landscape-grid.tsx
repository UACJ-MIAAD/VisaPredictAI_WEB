import type { ArticleModel } from "@/lib/article/article-copy.mjs";
import styles from "./article.module.css";

// Mapa brecha × horizonte del manuscrito: BSS puntual de la combinación frente a la referencia, color
// divergente recortado a ±0.15 (como la figura del artículo) y la tasa base debajo.

const CLIP = 0.15;

function cellBg(v: number | null) {
  if (v === null) return "var(--color-surface-soft)";
  const a = Math.min(Math.abs(v), CLIP) / CLIP;
  const pct = Math.round(10 + a * 55);
  const hue = v >= 0 ? "var(--color-accent)" : "var(--color-danger)";
  return `color-mix(in srgb, ${hue} ${pct}%, var(--color-bg))`;
}

export function LandscapeGrid({ m }: { m: ArticleModel }) {
  const es = m.lang === "es";
  const L = m.landscape;
  const yrs = (k: number) => `${k} ${es ? (k === 1 ? "año" : "años") : k === 1 ? "year" : "years"}`;
  return (
    <div className={styles.gridWrap}>
      <table className={styles.heat}>
        <caption className="sr-only">{m.sections.mapa.title}</caption>
        <thead>
          <tr>
            <th scope="col">{es ? "Brecha ↓ · horizonte →" : "Gap ↓ · horizon →"}</th>
            {L.horizons.map((k, i) => (
              <th key={k} scope="col">{yrs(k)}<span className={styles.heatN}>n = {L.nByHorizon[i]}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {L.cells.map((row) => (
            <tr key={row[0].g}>
              <th scope="row">{yrs(row[0].g)}</th>
              {row.map((c) => (
                <td key={c.k} style={{ background: cellBg(c.value) }}>
                  <span className={styles.heatVal}>{c.value === null ? "n/a" : c.text}</span>
                  <span className={styles.heatBase}>{es ? "tasa base" : "base rate"} {c.base}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.heatLegend}>
        <span className={styles.legendRamp} aria-hidden />
        {es
          ? "Rojo: la combinación es peor que la referencia · azul: mejor · color recortado a ±0.15 · n/a: ningún caso se volvió vigente, la habilidad no está definida."
          : "Red: the blend is worse than the reference · blue: better · colour clipped at ±0.15 · n/a: no case became current, skill is undefined."}
      </p>
    </div>
  );
}
