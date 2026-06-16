import { ArrowRight } from "lucide-react";

const STATS = [
  { num: "8", lbl: "Modelos comparados" },
  { num: "5", lbl: "Países / áreas piloto" },
  { num: "27,277", lbl: "Observaciones del panel" },
  { num: "64", lbl: "Referencias IEEE" },
  { num: "CRISP-DM", lbl: "Metodología nominada" },
];

export function Hero() {
  return (
    <section
      id="inicio"
      className="border-b border-border px-5 pb-12 pt-10 md:pt-14"
    >
      <div className="mx-auto max-w-[1140px]">
        <span className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
          <span className="h-0.5 w-6 bg-[var(--color-accent)]" aria-hidden />
          Anteproyecto MIAAD · UACJ · Mayo 2026
        </span>

        <h1 className="mt-5 max-w-[17ch] font-serif text-[2.6rem] font-black leading-[1.02] tracking-[-0.02em] md:text-[4.2rem]">
          Predicción de fechas de prioridad en el{" "}
          <em className="text-[var(--color-accent)]">Visa Bulletin</em> de los
          Estados&nbsp;Unidos
        </h1>

        <p className="mt-5 max-w-[66ch] text-[1.075rem] leading-relaxed text-muted-foreground">
          Sistema predictivo aplicado para el panel multiserie indexado por{" "}
          <strong className="text-foreground">país o área de cargabilidad</strong>{" "}
          ×{" "}
          <strong className="text-foreground">categoría migratoria</strong> ×{" "}
          <strong className="text-foreground">tipo de tabla</strong> × mes.
          Pronósticos a horizontes de 1, 3, 6 y 12 meses con{" "}
          <strong className="text-foreground">
            intervalos de predicción al 95&nbsp;%
          </strong>
          , bajo metodología <strong className="text-foreground">CRISP-DM</strong>{" "}
          y validación <em>walk-forward</em> expansiva — sin privilegiar
          arquitecturas de antemano.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href="#resumen"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            Leer el resumen <ArrowRight className="h-4 w-4" aria-hidden />
          </a>
          <a
            href="/datos-historicos"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-medium transition-colors hover:border-[var(--color-accent-2)]"
          >
            Explorar datos históricos
          </a>
        </div>

        {/* by-the-numbers strip */}
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-5">
          {STATS.map((s) => (
            <div key={s.lbl} className="bg-card p-5 text-center">
              <dt className="font-serif text-2xl font-extrabold tabular-nums text-[var(--color-accent)] md:text-3xl">
                {s.num}
              </dt>
              <dd className="mt-1 text-xs text-muted-foreground">{s.lbl}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
