"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArticleModel, MethodId } from "@/lib/article/article-copy.mjs";
import styles from "./article.module.css";

// Índice de habilidad de Brier frente a la clase de referencia (x = 0), por horizonte y método,
// con el intervalo al 95 % del bootstrap cola × año. Cifras: las del modelo (facts.tex).

export const METHOD_COLOR: Record<MethodId, string> = {
  blend: "var(--color-accent)",
  sim: "var(--color-accent-2)",
  rw: "var(--color-muted)",
  vel: "var(--color-danger)",
};

const ROW = 30, PAD_R = 18, TOP = 34;

export function HorizonChart({ m }: { m: ArticleModel }) {
  const es = m.lang === "es";
  const [on, setOn] = useState<Record<MethodId, boolean>>({ blend: true, sim: true, rw: true, vel: true });
  const [hover, setHover] = useState<{ k: number; id: MethodId } | null>(null);
  // El viewBox sigue al ancho real del contenedor: el texto conserva su tamaño en el teléfono.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const PAD_L = W < 520 ? 64 : 92;
  const shown = m.methods.filter((x) => on[x.id]);

  const { lo, hi } = useMemo(() => {
    const all = m.horizons.flatMap((h) => shown.flatMap((x) => h.methods[x.id].ci));
    const lo = Math.min(-0.2, ...all), hi = Math.max(0.2, ...all);
    return { lo: Math.floor(lo * 10) / 10, hi: Math.ceil(hi * 10) / 10 };
  }, [m, shown]);

  const groupH = Math.max(1, shown.length) * ROW + 26;
  const H = TOP + m.horizons.length * groupH + 30;
  const x = (v: number) => PAD_L + ((v - lo) / (hi - lo)) * (W - PAD_L - PAD_R);
  const ticks: number[] = [];
  for (let t = lo; t <= hi + 1e-9; t += 0.2) ticks.push(Math.round(t * 10) / 10);

  const sel = hover ? m.horizons.find((h) => h.k === hover.k) : null;
  const selM = hover ? m.methods.find((x) => x.id === hover.id) : null;

  return (
    <div className={styles.chartWrap}>
      <div className={styles.toggles} role="group" aria-label={es ? "Métodos visibles" : "Visible methods"}>
        {m.methods.map((x) => (
          <button key={x.id} type="button" aria-pressed={on[x.id]} className={styles.toggle}
            onClick={() => setOn((s) => ({ ...s, [x.id]: !s[x.id] }))}>
            <span className={styles.swatch} style={{ background: METHOD_COLOR[x.id] }} aria-hidden />
            {x.label}
          </button>
        ))}
      </div>
      <div ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={styles.chartFluid} role="img"
          aria-label={es ? "Índice de habilidad de Brier por horizonte y método, con intervalos al 95 %" : "Brier skill score by horizon and method, with 95 % intervals"}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={TOP - 8} y2={H - 26} className={t === 0 ? styles.zero : styles.grid} />
              <text x={x(t)} y={H - 8} textAnchor="middle" className={styles.tick}>{t === 0 ? "0" : t.toFixed(1).replace("-", "−")}</text>
            </g>
          ))}
          <text x={x(0) - 6} y={TOP - 14} textAnchor="end" className={styles.zeroLabel}>{es ? "clase de referencia" : "reference class"}</text>
          <text x={x(lo) + 2} y={TOP - 14} className={styles.tick}>{es ? "← peor" : "← worse"}</text>
          <text x={x(0) + 6} y={TOP - 14} className={styles.tick}>{es ? "mejor →" : "better →"}</text>
          {m.horizons.map((h, gi) => {
            const gy = TOP + gi * groupH;
            return (
              <g key={h.k}>
                <text x={8} y={gy + groupH / 2} dominantBaseline="middle" className={styles.groupLabel}>{h.label}</text>
                {shown.map((meth, i) => {
                  const e = h.methods[meth.id];
                  const y = gy + 14 + i * ROW;
                  const active = hover?.k === h.k && hover?.id === meth.id;
                  return (
                    <g key={meth.id} tabIndex={0} role="button" className={styles.est}
                      aria-label={`${h.label} · ${meth.label}: ${e.text} ${e.ciText}`}
                      onMouseEnter={() => setHover({ k: h.k, id: meth.id })} onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ k: h.k, id: meth.id })} onBlur={() => setHover(null)}>
                      <rect x={PAD_L} y={y - ROW / 2} width={W - PAD_L - PAD_R} height={ROW} fill="transparent" />
                      <line x1={x(e.ci[0])} x2={x(e.ci[1])} y1={y} y2={y} stroke={METHOD_COLOR[meth.id]} strokeWidth={active ? 4 : 2.5} strokeLinecap="round" />
                      <circle cx={x(e.value)} cy={y} r={active ? 7 : 5.5} fill={METHOD_COLOR[meth.id]} className={styles.estDot} />
                      {meth.id === "blend" && (
                        <g>
                          <line x1={x(e.ci[1])} x2={x(e.ci[1])} y1={y - 9} y2={y + 9} stroke={METHOD_COLOR.blend} strokeWidth={2} />
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <p className={styles.readout} aria-live="polite">
        {sel && selM ? (
          <>
            <strong style={{ color: METHOD_COLOR[selM.id] }}>{selM.label}</strong>{" · "}{sel.label}{": "}
            BSS {sel.methods[selM.id].text} <span className={styles.ci}>{sel.methods[selM.id].ciText}</span>
            {selM.id === "blend" && <> · {es ? "límite superior" : "upper bound"} {sel.upper}</>}
            {" · "}{sel.n} {es ? "casos" : "cases"}, {sel.series} series
          </>
        ) : (
          <span className={styles.muted}>{es ? "Pasa el cursor o enfoca una estimación para ver su valor y su intervalo." : "Hover or focus an estimate to read its value and interval."}</span>
        )}
      </p>
    </div>
  );
}
