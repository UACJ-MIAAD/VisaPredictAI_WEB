"use client";

// Annotated gallery of the 11 EDA figures (public/data/eda/*.png, 300 dpi,
// refreshed with every bulletin by the data repo's Action). Editorial layout:
// numbered kicker + headline + short reading, then the figure on a light plate
// (--color-figure-plate) so the white-background PNGs look intentional in dark
// mode — same precedent as the ER diagram card. Images are lazy and CLS-safe
// (intrinsic width/height via next/image; export is unoptimized so it emits a
// plain <img>).

import * as React from "react";
import Image from "next/image";
import { useLang } from "@/components/lang-provider";

type FigCopy = { tag: string; headline: string; body: string; alt: string };

type Fig = { id: string; w: number; h: number };

// Display order is the narrative order (not the file numbering).
const FIGS: Fig[] = [
  { id: "g01_panel", w: 2979, h: 3444 },
  { id: "g11_completitud", w: 3397, h: 2235 },
  { id: "g02_trayectorias", w: 2750, h: 1757 },
  { id: "g03_backlog", w: 2823, h: 1843 },
  { id: "g08_congelados", w: 2867, h: 1904 },
  { id: "g04_retros", w: 2861, h: 1714 },
  { id: "g05_brecha", w: 2675, h: 2045 },
  { id: "g06_pulso_fiscal", w: 3819, h: 2004 },
  { id: "g09_estacionariedad", w: 3151, h: 1638 },
  { id: "g07_leadlag", w: 3286, h: 1823 },
  { id: "g10_dv", w: 3567, h: 1774 },
];

const T: Record<
  "es" | "en",
  {
    title: string;
    sub: string;
    note?: string;
    figura: string;
    fullSize: string;
    figs: Record<string, FigCopy>;
  }
> = {
  es: {
    title: "Galería comentada",
    sub: "Once figuras del reporte EDA, cada una con su hallazgo. Se regeneran con cada boletín.",
    figura: "Figura",
    fullSize: "Ver a tamaño completo",
    figs: {
      g01_panel: {
        tag: "El panel",
        headline: "27,611 meses de fila en una sola imagen",
        body: "Cada fila es una de las 194 series (país × categoría × tabla) y cada celda un boletín mensual desde diciembre de 2001: azul cuando la fecha avanza, gris cuando se congela, vino cuando retrocede y verde azulado cuando la categoría está en Current (sin atraso). El blanco marca meses donde la serie no existe — por ejemplo, DFF antes de octubre de 2015. De un vistazo se ve el hallazgo central: en el 45 % de los meses con fecha, la fila no se movió.",
        alt: "Mapa de calor del panel completo: 194 series por 296 boletines, coloreado por régimen (avanza, congelada, retrocede, Current).",
      },
      g11_completitud: {
        tag: "Completitud",
        headline: "El 58 % del panel es entrenable",
        body: "Radiografía de completitud de las 194 series estructurales: la fracción de meses en cada régimen (F/C/U/sin dato), ordenada dentro de cada bloque. El bloque familiar es casi íntegramente entrenable; el de empleo vive en Current y Unavailable. La cobertura es escalonada: 194 series → 136 con fechas → 74 plenamente evaluables.",
        alt: "Barras apiladas de completitud por serie: fracción de meses en F, C, U y sin dato para las 194 series estructurales.",
      },
      g02_trayectorias: {
        tag: "Trayectorias",
        headline: "Un cuarto de siglo de fila, serie por serie",
        body: "Las 25 series familiares (FAD) avanzan con pendientes muy distintas por país. La línea punteada marca enero de 2011, cuando 17 series retrocedieron 34 años acumulados en un solo boletín; la banda gris, el congelamiento de la pandemia.",
        alt: "Trayectorias de las 25 series familiares FAD de 2001 a 2026, con la retrogresión de enero de 2011 y la banda de la pandemia marcadas.",
      },
      g03_backlog: {
        tag: "La fila hoy",
        headline: "¿Cuántos años de fila?",
        body: "El atraso vigente por categoría y área en el boletín más reciente, con México resaltado: una petición F4 o F3 mexicana espera 25 años. En empleo, India EB-3 encabeza con 12. Las áreas en Current no aparecen: no tienen fila.",
        alt: "Barras horizontales del atraso vigente en años por categoría y área de cargabilidad, con México resaltado.",
      },
      g08_congelados: {
        tag: "Congelamiento",
        headline: "La serie típica pasa 27 % de los meses congelada",
        body: "Porcentaje de meses sin movimiento por serie familiar (FAD). Contando el bloque de empleo, el panel completo sube a 45 %. Es la razón de que el pronóstico ingenuo sea tan difícil de vencer.",
        alt: "Barras del porcentaje de meses congelados por serie familiar FAD.",
      },
      g04_retros: {
        tag: "Retrogresiones",
        headline: "382 veces la fila retrocedió",
        body: "Cada punto es un mes en que alguna serie retrocedió (el 2.4 % de los avances observados); el tamaño es proporcional a la magnitud. Los terremotos están anotados: hasta −12.8 años en un solo mes (México F3, agosto de 2006).",
        alt: "Dispersión temporal de las 382 retrogresiones, con el tamaño según su magnitud y los mayores retrocesos anotados.",
      },
      g05_brecha: {
        tag: "Brecha FAD–DFF",
        headline: "Presentar el trámite 7 meses antes: eso vale la tabla DFF",
        body: "Atraso vigente por serie según la tabla que se mire: el calendario de presentación (DFF) siempre antecede a la acción final (FAD), con una brecha mediana cercana a 7 meses y un máximo de 2 años (Filipinas F1).",
        alt: "Comparación del atraso por serie entre las tablas FAD y DFF; la brecha mediana ronda los 7 meses.",
      },
      g06_pulso_fiscal: {
        tag: "Pulso fiscal",
        headline: "El año fiscal apenas late",
        body: "Avance mediano del panel por mes, en orden del año fiscal (octubre primero) y por año fiscal. El mes típico avanza entre 0 y 21 días y no hay estacionalidad explotable — un hallazgo, no una carencia. Destaca la era congelada FY2022–FY2026.",
        alt: "Mapa de calor del avance mediano por mes del año fiscal y por año fiscal; sin estacionalidad explotable.",
      },
      g09_estacionariedad: {
        tag: "Estacionariedad",
        headline: "71 de 74 series exigen diferenciación",
        body: "El censo de estacionariedad (ADF vs. KPSS) juzga las 74 series evaluables de un vistazo: ninguna es estacionaria en nivel, 71 exigen diferenciación y 3 dan señales mixtas. El panel es integrado de orden 1, sin excepciones.",
        alt: "Censo ADF contra KPSS de las 74 series evaluables: 71 exigen diferenciación y 3 dan señales mixtas.",
      },
      g07_leadlag: {
        tag: "Lead–lag",
        headline: "Nadie anticipa a nadie",
        body: "La mejor correlación cruzada entre áreas (retardos de ±6 meses) ocurre siempre en el retardo cero: solo 5 parejas se mueven de la mano (India–China–Resto del mundo) y el co-movimiento es contemporáneo. No hay indicadores adelantados entre países.",
        alt: "Correlaciones cruzadas entre áreas con retardos de ±6 meses; el máximo ocurre siempre en el retardo cero.",
      },
      g10_dv: {
        tag: "Visas de diversidad",
        headline: "La lotería también hace fila",
        body: "El sorteo de diversidad publica rangos de corte por región: 1,647 observaciones con el diente de sierra del año fiscal (el corte sube y se reinicia cada octubre). África corta sistemáticamente más alto. Es un número de sorteo, no una fecha: queda fuera del objetivo predictivo.",
        alt: "Series del rango de corte del sorteo de visas de diversidad por región, con el diente de sierra del año fiscal.",
      },
    },
  },
  en: {
    title: "Annotated gallery",
    sub: "Eleven figures from the EDA report, each with its finding. They regenerate with every bulletin.",
    note: "Figure labels are in Spanish.",
    figura: "Figure",
    fullSize: "View full size",
    figs: {
      g01_panel: {
        tag: "The panel",
        headline: "27,611 months in line, in a single image",
        body: "Each row is one of the 194 series (country × category × table) and each cell a monthly bulletin since December 2001: blue when the date advances, gray when it freezes, wine when it retrogresses, and teal when the category is Current (no backlog). White marks months where the series does not exist — for example, DFF before October 2015. The central finding is visible at a glance: in 45% of months with a date, the line did not move.",
        alt: "Heatmap of the full panel: 194 series by 296 bulletins, colored by regime (advancing, frozen, retrogressing, Current).",
      },
      g11_completitud: {
        tag: "Completeness",
        headline: "58% of the panel is trainable",
        body: "A completeness X-ray of the 194 structural series: the fraction of months in each regime (F/C/U/no data), sorted within each block. The family block is almost entirely trainable; the employment block lives in Current and Unavailable. Coverage is tiered: 194 series → 136 with dates → 74 fully evaluable.",
        alt: "Stacked completeness bars per series: fraction of months in F, C, U and no-data for the 194 structural series.",
      },
      g02_trayectorias: {
        tag: "Trajectories",
        headline: "A quarter century in line, series by series",
        body: "The 25 family series (FAD) advance with very different slopes by country. The dotted line marks January 2011, when 17 series retrogressed 34 accumulated years in a single bulletin; the gray band, the pandemic freeze.",
        alt: "Trajectories of the 25 family FAD series from 2001 to 2026, with the January 2011 retrogression and the pandemic band marked.",
      },
      g03_backlog: {
        tag: "The line today",
        headline: "How many years in line?",
        body: "The current backlog by category and area in the latest bulletin, with Mexico highlighted: a Mexican F4 or F3 petition waits 25 years. In employment, India EB-3 leads with 12. Areas in Current do not appear: they have no line.",
        alt: "Horizontal bars of the current backlog in years by category and chargeability area, with Mexico highlighted.",
      },
      g08_congelados: {
        tag: "Freezes",
        headline: "The typical series spends 27% of its months frozen",
        body: "Percentage of months without movement per family series (FAD). Counting the employment block, the full panel rises to 45%. It is the reason the naïve forecast is so hard to beat.",
        alt: "Bars of the percentage of frozen months per family FAD series.",
      },
      g04_retros: {
        tag: "Retrogressions",
        headline: "382 times the line moved backwards",
        body: "Each dot is a month in which some series retrogressed (2.4% of observed movements); size is proportional to magnitude. The earthquakes are annotated: up to −12.8 years in a single month (Mexico F3, August 2006).",
        alt: "Time scatter of the 382 retrogressions, sized by magnitude, with the largest setbacks annotated.",
      },
      g05_brecha: {
        tag: "FAD–DFF gap",
        headline: "Filing seven months earlier: that is what the DFF table is worth",
        body: "Current backlog per series depending on the table you look at: the filing calendar (DFF) always precedes final action (FAD), with a median gap close to 7 months and a maximum of 2 years (Philippines F1).",
        alt: "Per-series backlog compared across the FAD and DFF tables; the median gap is about 7 months.",
      },
      g06_pulso_fiscal: {
        tag: "Fiscal pulse",
        headline: "The fiscal year barely has a pulse",
        body: "Median panel advance per month, in fiscal-year order (October first) and by fiscal year. The typical month advances between 0 and 21 days and there is no exploitable seasonality — a finding, not a shortcoming. The frozen FY2022–FY2026 era stands out.",
        alt: "Heatmap of the median advance by fiscal-year month and by fiscal year; no exploitable seasonality.",
      },
      g09_estacionariedad: {
        tag: "Stationarity",
        headline: "71 of 74 series demand differencing",
        body: "The stationarity census (ADF vs. KPSS) judges the 74 evaluable series at a glance: none is stationary in level, 71 demand differencing and 3 give mixed signals. The panel is integrated of order 1, without exceptions.",
        alt: "ADF versus KPSS census of the 74 evaluable series: 71 demand differencing and 3 give mixed signals.",
      },
      g07_leadlag: {
        tag: "Lead–lag",
        headline: "No one leads anyone",
        body: "The best cross-correlation between areas (lags of ±6 months) always occurs at lag zero: only 5 pairs move hand in hand (India–China–Rest of the world) and the co-movement is contemporaneous. There are no leading indicators across countries.",
        alt: "Cross-correlations between areas at lags of ±6 months; the maximum always occurs at lag zero.",
      },
      g10_dv: {
        tag: "Diversity visas",
        headline: "The lottery waits in line too",
        body: "The diversity lottery publishes cutoff ranks by region: 1,647 observations with the fiscal-year sawtooth (the cutoff climbs and resets every October). Africa consistently cuts higher. It is a lottery rank, not a date: it stays outside the predictive target.",
        alt: "Diversity-visa cutoff-rank series by region, with the fiscal-year sawtooth pattern.",
      },
    },
  },
};

export function EdaGallery() {
  const { lang } = useLang();
  const t = T[lang];

  return (
    <div className="mt-16">
      <h3 className="font-serif text-xl font-bold text-[var(--color-ink)]">{t.title}</h3>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-muted)]">
        {t.sub}
        {t.note ? <> {t.note}</> : null}
      </p>

      <div className="mt-10 space-y-16">
        {FIGS.map((f, i) => {
          const c = t.figs[f.id];
          const src = `/data/eda/${f.id}.png`;
          return (
            // sin m-0 en el figure: anulaba el space-y-16 del contenedor (misma
            // especificidad que la utilidad space-y de Tailwind v4; el orden gana)
            <figure key={f.id}>
              <figcaption>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                  {t.figura} {i + 1} · {c.tag}
                </p>
                <h4 className="mt-1.5 font-serif text-2xl font-bold leading-snug text-[var(--color-ink)]">
                  {c.headline}
                </h4>
                <p className="mt-2 max-w-3xl leading-relaxed text-[var(--color-muted)]">{c.body}</p>
              </figcaption>
              <a
                href={src}
                target="_blank"
                rel="noopener"
                aria-label={`${c.headline} — ${t.fullSize}`}
                className="group mt-5 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)]"
              >
                <Image
                  src={src}
                  alt={c.alt}
                  width={f.w}
                  height={f.h}
                  loading="lazy"
                  className="h-auto w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-figure-plate)] p-2 sm:p-3"
                />
                <span className="mt-2 inline-block text-xs text-[var(--color-muted)] underline-offset-2 transition-colors group-hover:text-[var(--color-accent)] group-hover:underline group-focus-visible:text-[var(--color-accent)]">
                  {t.fullSize} ↗
                </span>
              </a>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
