"use client";

// Home teasers (AU1): two editorial cards — the forecast ("when is my date?")
// and the evidence (three REAL stats from the prospective scorecard, loaded
// client-side exactly like scorecard.tsx). No hardcoded figures (regla #0):
// if the scorecard is not shipped, the evidence card shows the CTA alone.

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { localePath } from "@/lib/site-map";
import { track } from "@/lib/analytics";
import { loadForecasts, type Scorecard } from "@/lib/data/forecasts";

const T = {
  es: {
    kicker: "Pronóstico y evidencia",
    fcTitle: "¿Cuándo me toca?",
    fcBody:
      "Elige tu país o área, categoría y tabla y mira el pronóstico del modelo desplegado a 12 meses, con bandas de predicción al 80 % / 95 %.",
    fcCta: "Ver el pronóstico de tu categoría",
    evTitle: "La evidencia, contra la realidad",
    evBody:
      "Cada pronóstico se congela antes de su mes objetivo y luego se califica contra el boletín real publicado.",
    evCta: "Ver el marcador prospectivo",
    mae: "días de error medio (MAE)",
    mase: "MASE (vs naïve estacional)",
    cov: "cobertura del intervalo 95 %",
  },
  en: {
    kicker: "Forecast & evidence",
    fcTitle: "When is my date?",
    fcBody:
      "Pick your country or area, category and table and see the deployed model's 12-month forecast, with 80% / 95% prediction bands.",
    fcCta: "See your category's forecast",
    evTitle: "The evidence, against reality",
    evBody:
      "Every forecast is frozen before its target month and later graded against the real published bulletin.",
    evCta: "See the prospective scorecard",
    mae: "days mean error (MAE)",
    mase: "MASE (vs seasonal naïve)",
    cov: "95% interval coverage",
  },
};

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[7rem]">
      <div className="font-serif text-2xl font-extrabold tabular-nums text-[var(--color-accent)]">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Cta({ href, onClick, children }: { href: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group mt-4 inline-flex items-center gap-2 font-medium text-[var(--color-accent)]"
    >
      {children}
      <ArrowRight
        className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export function Teasers() {
  const { lang } = useLang();
  const t = T[lang];
  const [sc, setSc] = React.useState<Scorecard | null>(null);

  React.useEffect(() => {
    let alive = true;
    loadForecasts().then((store) => {
      if (alive) setSc(store.scorecard);
    });
    return () => {
      alive = false;
    };
  }, []);

  const datosBase = localePath("/datos-historicos", lang);

  return (
    <section id="evidencia" className="section">
      <div className="section-inner">
        <span className="section-tag">{t.kicker}</span>
        <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
          <div className="border-t-2 border-[var(--color-rule)] pt-3">
            <h3 className="font-serif text-2xl font-bold">{t.fcTitle}</h3>
            <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
              {t.fcBody}
            </p>
            <Cta
              href={`${datosBase}#pronostico`}
              onClick={() => track("Forecast CTA", { from: "teaser" })}
            >
              {t.fcCta}
            </Cta>
          </div>

          <div className="border-t-2 border-[var(--color-rule)] pt-3">
            <h3 className="font-serif text-2xl font-bold">{t.evTitle}</h3>
            <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
              {t.evBody}
            </p>
            {sc ? (
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                <MiniStat value={sc.overall.mae_days.toFixed(0)} label={t.mae} />
                <MiniStat value={sc.overall.mase.toFixed(3)} label={t.mase} />
                <MiniStat value={`${Math.round(sc.overall.cov95 * 100)}%`} label={t.cov} />
              </div>
            ) : null}
            <Cta
              href={`${datosBase}#scorecard`}
              onClick={() => track("Scorecard CTA", { from: "teaser" })}
            >
              {t.evCta}
            </Cta>
          </div>
        </div>
      </div>
    </section>
  );
}
