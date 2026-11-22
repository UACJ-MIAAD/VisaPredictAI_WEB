import styles from "./article.module.css";

// Ilustración ESQUEMÁTICA del tiempo de primer paso (no son datos del panel): trayectorias de un
// corte que avanza a saltos, con meses congelados y alguna retrogresión, hacia la fecha de
// prioridad. La probabilidad P(T ≤ K) es la fracción de trayectorias que la rebasa antes de K.
// Semilla fija: el SVG es idéntico en cada build (render en servidor, sin JS en cliente).

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 560, H = 340, X0 = 34, X1 = 540, Y0 = 300, YT = 92, MONTHS = 120, N = 30;

export function HeroVisual({ lang }: { lang: "es" | "en" }) {
  const es = lang === "es";
  const rnd = mulberry32(20261121);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const dx = (X1 - X0) / MONTHS;
  const paths: { d: string; cross: number | null }[] = [];
  for (let p = 0; p < N; p++) {
    let y = Y0, x = X0, cross: number | null = null;
    const drift = 2.6 + rnd() * 3;
    let d = `M${X0},${Y0}`;
    for (let m = 1; m <= MONTHS; m++) {
      x = X0 + m * dx;
      const r = rnd();
      if (r < 0.45) {
        /* frozen month */
      } else if (r < 0.47) y = Math.min(Y0, y + 12 + rnd() * 26); // retrogression
      else y = Math.max(20, y - Math.abs(drift + gauss() * 2.2));
      d += `H${x.toFixed(1)}V${y.toFixed(1)}`;
      if (cross === null && y <= YT) cross = x;
    }
    paths.push({ d, cross });
  }
  const crossed = paths.filter((p) => p.cross !== null).length;
  const yr = (k: number) => X0 + (k * 12) * dx;

  return (
    <figure className={styles.heroFig} aria-labelledby="hero-fig-cap">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={es
        ? `Ilustración: ${N} trayectorias simuladas de un corte; ${crossed} rebasan la fecha de prioridad en diez años`
        : `Illustration: ${N} simulated cutoff paths; ${crossed} pass the priority date within ten years`}>
        {[0, 2, 4, 6, 8, 10].map((k) => (
          <g key={k}>
            <line x1={yr(k)} x2={yr(k)} y1={20} y2={Y0} className={styles.heroRule} />
            <text x={yr(k)} y={Y0 + 20} textAnchor="middle" className={styles.heroAxis}>{k === 0 ? (es ? "hoy" : "today") : `${k} ${es ? "a" : "y"}`}</text>
          </g>
        ))}
        {paths.map((p, i) => (
          <path key={i} d={p.d} pathLength={1} className={p.cross !== null ? styles.heroPathHit : styles.heroPath}
            style={{ animationDelay: `${(i % 10) * 0.12}s` }} />
        ))}
        {paths.map((p, i) => p.cross !== null && (
          <circle key={`c${i}`} cx={p.cross} cy={YT} r={3} className={styles.heroDot} style={{ animationDelay: `${1.4 + (i % 10) * 0.12}s` }} />
        ))}
        <line x1={X0} x2={X1} y1={YT} y2={YT} className={styles.heroTarget} />
        <text x={X1} y={YT - 10} textAnchor="end" className={styles.heroTargetLabel}>{es ? "tu fecha de prioridad" : "your priority date"}</text>
      </svg>
      <figcaption id="hero-fig-cap" className={styles.heroCap}>
        <strong>P(T ≤ 10 {es ? "años" : "years"}) ≈ {crossed}/{N}</strong>{" "}
        {es
          ? "Esquema, no datos: cada línea es un futuro posible del corte, que avanza a saltos, se congela y a veces retrocede. La probabilidad es la fracción de futuros que rebasa tu fecha."
          : "A sketch, not data: each line is one possible future of the cutoff, which jumps, freezes and sometimes retrogresses. The probability is the share of futures that pass your date."}
      </figcaption>
    </figure>
  );
}
