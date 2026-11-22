import type { Point } from "@/lib/article/article-copy.mjs";
import styles from "./article.module.css";

// Gráfica de bosque (server): una fila por diseño o subgrupo, tres horizontes por fila,
// punto + intervalo al 95 %, eje común con el cero de la clase de referencia marcado.

type Row = { id: string; label: string; points: Point[] };
const HZ_SHADE = ["var(--color-accent-2)", "var(--color-muted)", "var(--color-accent)"];

export function Forest({ rows, lang, title }: { rows: Row[]; lang: "es" | "en"; title: string }) {
  const es = lang === "es";
  const W = 540, L = 178, R = 28, ROWH = 50, TOP = 24;
  const all = rows.flatMap((r) => r.points.flatMap((p) => p.ci));
  const lo = Math.floor(Math.min(-0.1, ...all) * 10) / 10;
  const hi = Math.ceil(Math.max(0.1, ...all) * 10) / 10;
  const x = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R);
  const H = TOP + rows.length * ROWH + 26;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += 0.1) ticks.push(Math.round(t * 10) / 10);

  return (
    <figure className={styles.forest}>
      <div className={styles.chartScroll}>
        <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={TOP - 6} y2={H - 24} className={t === 0 ? styles.zero : styles.grid} />
              <text x={x(t)} y={H - 6} textAnchor="middle" className={styles.tick}>{t === 0 ? "0" : t.toFixed(1).replace("-", "−")}</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = TOP + i * ROWH + ROWH / 2;
            return (
              <g key={r.id}>
                <text x={L - 14} y={y} textAnchor="end" dominantBaseline="middle" className={styles.rowLabel}>{r.label}</text>
                {r.points.map((p, j) => {
                  const yy = y + (j - 1) * 12;
                  return (
                    <g key={p.k}>
                      <title>{`${r.label} · ${p.k} ${es ? (p.k === 1 ? "año" : "años") : p.k === 1 ? "year" : "years"}: ${p.text} ${p.ciText}${p.n ? ` · n ${p.n}` : ""}`}</title>
                      <line x1={x(p.ci[0])} x2={x(p.ci[1])} y1={yy} y2={yy} stroke={HZ_SHADE[j]} strokeWidth={2} strokeLinecap="round" />
                      <circle cx={x(p.value)} cy={yy} r={4.2} fill={HZ_SHADE[j]} />
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className={styles.forestLegend}>
        {[1, 3, 5].map((k, j) => (
          <span key={k}><span className={styles.swatch} style={{ background: HZ_SHADE[j] }} aria-hidden /> {k} {es ? (k === 1 ? "año" : "años") : k === 1 ? "year" : "years"}</span>
        ))}
        <span className={styles.muted}>{es ? "Punto: BSS · línea: intervalo al 95 %" : "Dot: BSS · line: 95 % interval"}</span>
      </figcaption>
    </figure>
  );
}
