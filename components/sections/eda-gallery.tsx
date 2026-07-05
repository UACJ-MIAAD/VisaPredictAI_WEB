"use client";

// Annotated gallery of the 11 EDA figures, refreshed with every bulletin by the
// data repo's Action. Each figure ships in FOUR true renders (language × theme):
// public/data/eda/*.png (Spanish light, on the --color-figure-plate),
// eda/dark/*.png (Spanish dark, charcoal #12161B surface from the data repo's
// vp_model/palette.py DARK theme, on --color-figure-plate-dark), and their
// English counterparts under eda/en/ and eda/en/dark/ (the /en/* pages used to
// serve PNGs with rasterized Spanish headlines). The language is picked at
// render time (route-driven, so it is server-stable); both THEME <img>s are in
// the DOM and CSS-toggled via Tailwind's `dark:` variant (wired to the .dark
// class next-themes stamps on <html> pre-paint) — no hydration flash, and the
// full-size link always points at the visible variant. Images are lazy and
// CLS-safe (per-variant intrinsic width/height via next/image; export is
// unoptimized so it emits a plain <img>; a display:none lazy image is not
// fetched until its theme becomes active).
//
// EVERY drifting number in the captions is DERIVED at render time from the
// fetched /data/eda_facts.json (passed down as `facts`): the figures regenerate
// with every bulletin and the data repo's consistency guardian does not scan
// React components, so no census number may live here as a literal. Only stable
// structural facts stay literal (Dec-2001 panel start, Oct-2015 DFF start, the
// ±6-month lead–lag window, qualitative claims taken from the report).

import * as React from "react";
import Image from "next/image";
import { useLang } from "@/components/lang-provider";
import { Lightbox } from "@/components/ui/lightbox";
import { type EdaFacts } from "@/lib/data/eda";
import { derive, type Derived } from "@/lib/data/eda-derive";
import { figDim, type Dim } from "@/lib/data/fig-dims";

type LangDims = { light: Dim; dark: Dim };
type Fig = { id: string; es: LangDims; en: LangDims };

// Display order is the narrative order (not the file numbering). Rendered
// dimensions come from /data/fig_dims.json — measured per variant from the
// PNGs actually shipped (audit B1) — and these constants are only the fallback
// for figures missing from that map. They were measured per language (the
// header textwrap re-flows with the translated copy).
const dims = (w: number, h: number): LangDims => ({ light: { w, h }, dark: { w, h } });
const FIGS: Fig[] = [
  { id: "g01_panel", es: dims(2652, 3509), en: dims(2679, 3509) },
  { id: "g11_completitud", es: dims(2764, 2300), en: dims(2764, 2298) },
  { id: "g02_trayectorias", es: dims(2588, 1822), en: dims(2588, 1822) },
  { id: "g03_backlog", es: dims(2823, 1908), en: dims(2823, 1906) },
  { id: "g08_congelados", es: dims(2294, 2034), en: dims(2294, 2032) },
  { id: "g04_retros", es: dims(2588, 1779), en: dims(2588, 1841) },
  { id: "g05_brecha", es: dims(2412, 2109), en: dims(2412, 2175) },
  { id: "g06_pulso_fiscal", es: dims(2176, 2190), en: dims(2176, 2186) },
  { id: "g09_estacionariedad", es: dims(2118, 1703), en: dims(2118, 1701) },
  { id: "g07_leadlag", es: dims(1803, 2059), en: dims(1745, 1991) },
  { id: "g10_dv", es: dims(2588, 1838), en: dims(2588, 1839) },
];


type FigCopy = {
  tag: string;
  headline: (d: Derived) => string;
  body: (d: Derived) => string;
  alt: string; // static and number-free by design (no unguarded drift)
};

const T: Record<
  "es" | "en",
  {
    title: string;
    sub: string;
    note?: string;
    figura: string;
    fullSize: string;
    openOriginal: string;
    close: string;
    figs: Record<string, FigCopy>;
  }
> = {
  es: {
    title: "Galería comentada",
    sub: "Once figuras del reporte EDA, cada una con su hallazgo. Se regeneran con cada boletín.",
    figura: "Figura",
    fullSize: "Ver a tamaño completo",
    openOriginal: "Abrir original",
    close: "Cerrar",
    figs: {
      g01_panel: {
        tag: "El panel",
        headline: (d) => `${d.nObs} meses de fila en una sola imagen`,
        body: (d) =>
          `Cada fila es una de las ${d.nSeries} series (país × categoría × tabla) y cada celda un boletín mensual desde diciembre de 2001: azul cuando la fecha avanza, gris cuando se congela, vino cuando retrocede y verde azulado cuando la categoría está en Current (sin atraso). El blanco marca meses donde la serie no existe — por ejemplo, DFF antes de octubre de 2015. De un vistazo se ve el hallazgo central: en el ${d.pctFrozen} % de los meses con fecha, la fila no se movió.`,
        alt: "Mapa de calor del panel completo, una fila por serie y una columna por boletín, coloreado por régimen (avanza, congelada, retrocede, Current).",
      },
      g11_completitud: {
        tag: "Completitud",
        headline: (d) => `El ${d.pctF} % del panel es entrenable`,
        body: (d) =>
          `Radiografía de completitud de las ${d.nSeries} series estructurales: la fracción de meses en cada régimen (F/C/U/sin dato), ordenada dentro de cada bloque. El bloque familiar es casi íntegramente entrenable; el de empleo vive en Current y Unavailable. La cobertura es escalonada: ${d.nSeries} series → ${d.nWithF} con fechas → ${d.nEval} plenamente evaluables.`,
        alt: "Barras apiladas de completitud por serie: fracción de meses en F, C, U y sin dato para todas las series estructurales.",
      },
      g02_trayectorias: {
        tag: "Trayectorias",
        headline: () => "Un cuarto de siglo de fila, serie por serie",
        body: (d) =>
          `Las ${d.nFamFad} series familiares (FAD) avanzan con pendientes muy distintas por país. La línea punteada marca ${d.aggMonth}, cuando ${d.aggCount} series retrocedieron ${d.aggYears} años acumulados en un solo boletín; la banda gris, el congelamiento de la pandemia.`,
        alt: "Trayectorias de las series familiares FAD desde 2001, con la mayor retrogresión colectiva y la banda de la pandemia marcadas.",
      },
      g03_backlog: {
        tag: "La fila hoy",
        headline: () => "¿Cuántos años de fila?",
        body: (d) =>
          `El atraso vigente por categoría y área en el boletín más reciente, con México resaltado: la serie más rezagada hoy, ${d.famBacklogLabel}, espera ${d.famBacklogYears} años. En empleo, ${d.empBacklogLabel} encabeza con ${d.empBacklogYears}. Las áreas en Current no aparecen: no tienen fila.`,
        alt: "Barras horizontales del atraso vigente en años por categoría y área de cargabilidad, con México resaltado.",
      },
      g08_congelados: {
        tag: "Congelamiento",
        headline: (d) => `La serie típica pasa ${d.typFrozen} % de los meses congelada`,
        body: (d) =>
          `Porcentaje de meses sin movimiento por serie familiar (FAD). Contando el bloque de empleo, el panel completo sube a ${d.pctFrozen} %. Es la razón de que el pronóstico ingenuo sea tan difícil de vencer.`,
        alt: "Barras del porcentaje de meses congelados por serie familiar FAD.",
      },
      g04_retros: {
        tag: "Retrogresiones",
        headline: (d) => `${d.nRetro} veces la fila retrocedió`,
        body: (d) =>
          `Cada punto es un mes en que alguna serie retrocedió (el ${d.pctRetro} % de los movimientos mensuales observados); el tamaño es proporcional a la magnitud. Los terremotos están anotados: hasta −${d.worstYears} años en un solo mes (${d.worstLabel}, ${d.worstMonth}).`,
        alt: "Dispersión temporal de las retrogresiones históricas, con el tamaño según su magnitud y los mayores retrocesos anotados.",
      },
      g05_brecha: {
        tag: "Brecha FAD–DFF",
        headline: (d) => `Presentar el trámite ${d.gapMonths} meses antes: eso vale la tabla DFF`,
        body: (d) =>
          `Atraso vigente por serie según la tabla que se mire: el calendario de presentación (DFF) siempre antecede a la acción final (FAD), con una brecha mediana cercana a ${d.gapMonths} meses y un máximo de ${d.gapMaxYears} años (${d.gapMaxLabel}).`,
        alt: "Comparación del atraso por serie entre las tablas FAD y DFF.",
      },
      g06_pulso_fiscal: {
        tag: "Pulso fiscal",
        headline: () => "El año fiscal apenas late",
        body: (d) =>
          `Avance mediano del panel por mes, en orden del año fiscal (octubre primero) y por año fiscal. El mes típico avanza entre ${d.advMin} y ${d.advMax} días y no hay estacionalidad explotable — un hallazgo, no una carencia. Destaca la era congelada de los últimos años fiscales.`,
        alt: "Mapa de calor del avance mediano por mes del año fiscal y por año fiscal; sin estacionalidad explotable.",
      },
      g09_estacionariedad: {
        tag: "Estacionariedad",
        headline: (d) => `${d.nDiff} de ${d.nEval} series exigen diferenciación`,
        body: (d) =>
          `El censo de estacionariedad (ADF vs. KPSS) juzga las ${d.nEval} series evaluables de un vistazo: ${
            d.nLevel === 0 ? "ninguna es estacionaria en nivel" : `${d.nLevel} son estacionarias en nivel`
          }, ${d.nDiff} exigen diferenciación y ${d.nMixed} dan señales mixtas. El panel es integrado de orden 1${
            d.nLevel === 0 ? ", sin excepciones" : ""
          }.`,
        alt: "Censo ADF contra KPSS de las series evaluables: casi todas exigen diferenciación.",
      },
      g07_leadlag: {
        tag: "Lead–lag",
        headline: () => "Nadie anticipa a nadie",
        body: () =>
          "La mejor correlación cruzada entre áreas (retardos de ±6 meses) ocurre siempre en el retardo cero: solo unas cuantas parejas se mueven de la mano —ninguna de ellas con México— y el co-movimiento es contemporáneo. No hay indicadores adelantados entre países.",
        alt: "Correlaciones cruzadas entre áreas con retardos de ±6 meses; el máximo ocurre siempre en el retardo cero.",
      },
      g10_dv: {
        tag: "Visas de diversidad",
        headline: () => "La lotería también hace fila",
        body: (d) =>
          `El sorteo de diversidad publica rangos de corte por región: ${d.dvRows} observaciones con el diente de sierra del año fiscal (el corte sube y se reinicia cada octubre). África corta sistemáticamente más alto. Es un número de sorteo, no una fecha: queda fuera del objetivo predictivo.`,
        alt: "Series del rango de corte del sorteo de visas de diversidad por región, con el diente de sierra del año fiscal.",
      },
    },
  },
  en: {
    title: "Annotated gallery",
    sub: "Eleven figures from the EDA report, each with its finding. They regenerate with every bulletin.",
    figura: "Figure",
    fullSize: "View full size",
    openOriginal: "Open original",
    close: "Close",
    figs: {
      g01_panel: {
        tag: "The panel",
        headline: (d) => `${d.nObs} months in line, in a single image`,
        body: (d) =>
          `Each row is one of the ${d.nSeries} series (country × category × table) and each cell a monthly bulletin since December 2001: blue when the date advances, gray when it freezes, wine when it retrogresses, and teal when the category is Current (no backlog). White marks months where the series does not exist — for example, DFF before October 2015. The central finding is visible at a glance: in ${d.pctFrozen}% of months with a date, the line did not move.`,
        alt: "Heatmap of the full panel, one row per series and one column per bulletin, colored by regime (advancing, frozen, retrogressing, Current).",
      },
      g11_completitud: {
        tag: "Completeness",
        headline: (d) => `${d.pctF}% of the panel is trainable`,
        body: (d) =>
          `A completeness X-ray of the ${d.nSeries} structural series: the fraction of months in each regime (F/C/U/no data), sorted within each block. The family block is almost entirely trainable; the employment block lives in Current and Unavailable. Coverage is tiered: ${d.nSeries} series → ${d.nWithF} with dates → ${d.nEval} fully evaluable.`,
        alt: "Stacked completeness bars per series: fraction of months in F, C, U and no-data for all structural series.",
      },
      g02_trayectorias: {
        tag: "Trajectories",
        headline: () => "A quarter century in line, series by series",
        body: (d) =>
          `The ${d.nFamFad} family series (FAD) advance with very different slopes by country. The dotted line marks ${d.aggMonth}, when ${d.aggCount} series retrogressed ${d.aggYears} accumulated years in a single bulletin; the gray band, the pandemic freeze.`,
        alt: "Trajectories of the family FAD series since 2001, with the largest collective retrogression and the pandemic band marked.",
      },
      g03_backlog: {
        tag: "The line today",
        headline: () => "How many years in line?",
        body: (d) =>
          `The current backlog by category and area in the latest bulletin, with Mexico highlighted: today's most delayed series, ${d.famBacklogLabel}, waits ${d.famBacklogYears} years. In employment, ${d.empBacklogLabel} leads with ${d.empBacklogYears}. Areas in Current do not appear: they have no line.`,
        alt: "Horizontal bars of the current backlog in years by category and chargeability area, with Mexico highlighted.",
      },
      g08_congelados: {
        tag: "Freezes",
        headline: (d) => `The typical series spends ${d.typFrozen}% of its months frozen`,
        body: (d) =>
          `Percentage of months without movement per family series (FAD). Counting the employment block, the full panel rises to ${d.pctFrozen}%. It is the reason the naïve forecast is so hard to beat.`,
        alt: "Bars of the percentage of frozen months per family FAD series.",
      },
      g04_retros: {
        tag: "Retrogressions",
        headline: (d) => `${d.nRetro} times the line moved backwards`,
        body: (d) =>
          `Each dot is a month in which some series retrogressed (${d.pctRetro}% of observed movements); size is proportional to magnitude. The earthquakes are annotated: up to −${d.worstYears} years in a single month (${d.worstLabel}, ${d.worstMonth}).`,
        alt: "Time scatter of the historical retrogressions, sized by magnitude, with the largest setbacks annotated.",
      },
      g05_brecha: {
        tag: "FAD–DFF gap",
        headline: (d) => `Filing ${d.gapMonths} months earlier: that is what the DFF table is worth`,
        body: (d) =>
          `Current backlog per series depending on the table you look at: the filing calendar (DFF) always precedes final action (FAD), with a median gap close to ${d.gapMonths} months and a maximum of ${d.gapMaxYears} years (${d.gapMaxLabel}).`,
        alt: "Per-series backlog compared across the FAD and DFF tables.",
      },
      g06_pulso_fiscal: {
        tag: "Fiscal pulse",
        headline: () => "The fiscal year barely has a pulse",
        body: (d) =>
          `Median panel advance per month, in fiscal-year order (October first) and by fiscal year. The typical month advances between ${d.advMin} and ${d.advMax} days and there is no exploitable seasonality — a finding, not a shortcoming. The frozen era of the most recent fiscal years stands out.`,
        alt: "Heatmap of the median advance by fiscal-year month and by fiscal year; no exploitable seasonality.",
      },
      g09_estacionariedad: {
        tag: "Stationarity",
        headline: (d) => `${d.nDiff} of ${d.nEval} series demand differencing`,
        body: (d) =>
          `The stationarity census (ADF vs. KPSS) judges the ${d.nEval} evaluable series at a glance: ${
            d.nLevel === 0 ? "none is stationary in level" : `${d.nLevel} are stationary in level`
          }, ${d.nDiff} demand differencing and ${d.nMixed} give mixed signals. The panel is integrated of order 1${
            d.nLevel === 0 ? ", without exceptions" : ""
          }.`,
        alt: "ADF versus KPSS census of the evaluable series: nearly all demand differencing.",
      },
      g07_leadlag: {
        tag: "Lead–lag",
        headline: () => "No one leads anyone",
        body: () =>
          "The best cross-correlation between areas (lags of ±6 months) always occurs at lag zero: only a handful of pairs move hand in hand — none of them involving Mexico — and the co-movement is contemporaneous. There are no leading indicators across countries.",
        alt: "Cross-correlations between areas at lags of ±6 months; the maximum always occurs at lag zero.",
      },
      g10_dv: {
        tag: "Diversity visas",
        headline: () => "The lottery waits in line too",
        body: (d) =>
          `The diversity lottery publishes cutoff ranks by region: ${d.dvRows} observations with the fiscal-year sawtooth (the cutoff climbs and resets every October). Africa consistently cuts higher. It is a lottery rank, not a date: it stays outside the predictive target.`,
        alt: "Diversity-visa cutoff-rank series by region, with the fiscal-year sawtooth pattern.",
      },
    },
  },
};

// One theme's variant: full <a><img/></a> block, shown/hidden purely via CSS
// (`dark:` variant) so the visible full-size link always matches the visible
// image and there is no client-side theme branching (no hydration flash).
// AX8: clicking now opens an in-page <dialog> lightbox (pinch-zoomable,
// Escape/backdrop to close); the href survives as the no-JS fallback and as
// the "open original" link inside the dialog.
export function FigureLink({
  src,
  dim,
  alt,
  ariaLabel,
  hint,
  originalLabel,
  closeLabel,
  toggle,
  plate,
  imgAriaHidden,
}: {
  src: string;
  dim: Dim;
  alt: string;
  ariaLabel: string;
  hint: string;
  // optional: consumers outside the galleries (e.g. problema.tsx) fall back
  // to the route language's default strings resolved below
  originalLabel?: string;
  closeLabel?: string;
  toggle: string; // "block dark:hidden" | "hidden dark:block"
  plate: string; // plate background class for this variant
  imgAriaHidden?: boolean; // audit B5: the theme duplicate must not double-announce
}) {
  const [open, setOpen] = React.useState(false);
  const { lang } = useLang();
  // Deterministic focus return: pointer clicks don't focus anchors in every
  // browser, so the native <dialog> restore can strand focus on <body> (audit).
  const triggerRef = React.useRef<HTMLAnchorElement | null>(null);
  const original = originalLabel ?? (lang === "en" ? "Open original" : "Abrir original");
  const close = closeLabel ?? (lang === "en" ? "Close" : "Cerrar");
  const isPng = /\.png$/.test(src);
  return (
    <div className={`mt-5 ${toggle}`}>
      <a
        href={src}
        ref={triggerRef}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-accent)]"
      >
        {/* Modern-format negotiation: the pipeline ships <name>.avif and
            <name>.webp next to every gallery <name>.png (all four language ×
            theme variants), so the <picture> sources are pure string rewrites
            and the PNG <img> stays as the universal fallback with its measured
            dims/alt/lazy loading. Each theme variant is its own <picture>,
            preserving the CSS dark-toggle: inside a display:none wrapper the
            lazy <img> governs the request, so the hidden variant never loads. */}
        <picture className="contents">
          {isPng && <source type="image/avif" srcSet={src.replace(/\.png$/, ".avif")} />}
          {isPng && <source type="image/webp" srcSet={src.replace(/\.png$/, ".webp")} />}
          <Image
            src={src}
            alt={alt}
            aria-hidden={imgAriaHidden || undefined}
            width={dim.w}
            height={dim.h}
            loading="lazy"
            className={`h-auto w-full rounded-xl border border-[var(--color-border)] p-2 sm:p-3 ${plate}`}
          />
        </picture>
        <span className="mt-2 inline-block text-xs text-[var(--color-muted)] underline-offset-2 transition-colors group-hover:text-[var(--color-accent)] group-hover:underline group-focus-visible:text-[var(--color-accent)]">
          {hint} ↗
        </span>
      </a>
      <Lightbox
        open={open}
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        src={src}
        dim={dim}
        alt={alt}
        originalLabel={original}
        closeLabel={close}
      />
    </div>
  );
}

export function EdaGallery({ facts }: { facts: EdaFacts }) {
  const { lang } = useLang();
  const t = T[lang];
  const d = React.useMemo(() => derive(facts, lang), [facts, lang]);

  return (
    <div className="mt-16">
      <h3 className="font-serif text-xl font-bold text-[var(--color-ink)]">{t.title}</h3>
      <p className="mt-1 max-w-3xl text-sm text-[var(--color-muted)]">
        {t.sub}
        {t.note ? <> {t.note}</> : null}
      </p>

      <div className="mt-10 space-y-16">
        {FIGS.filter(
          // audit B3: a figure whose caption numbers are not derivable from the
          // census hides itself rather than rendering "0 de 74" / "entre 0 y 0"
          (f) =>
            (f.id !== "g09_estacionariedad" || d.hasStationarity) &&
            (f.id !== "g06_pulso_fiscal" || d.hasAdvance),
        ).map((f, i) => {
          const c = t.figs[f.id];
          const headline = c.headline(d);
          const ariaLabel = `${headline} — ${t.fullSize}`;
          const prefix = lang === "en" ? "eda/en" : "eda";
          const fallback = f[lang];
          return (
            // sin m-0 en el figure: anulaba el space-y-16 del contenedor (misma
            // especificidad que la utilidad space-y de Tailwind v4; el orden gana)
            //
            // Ultrawide (AY2 vs AY3 — decisión): AY3 GANA en las galerías. En
            // ≥1536px cada figura pasa a dos columnas —caption sticky a la
            // izquierda (32–38ch), imagen a la derecha— y el breakout de AY2 se
            // aplica MODERADO sobre la misma <figure>: crece hasta
            // min(1600px, 90vw) centrada con márgenes negativos simétricos
            // (el padre es .section-inner = var(--container), 1320px en 2xl),
            // de modo que la imagen recibe ~2/3 del riel ampliado + el extra
            // del breakout sin pelearse con la grid. El wrapper min-w-0 agrupa
            // las dos variantes de tema en UNA celda; su 2xl:-mt-5 cancela el
            // mt-5 interno de FigureLink para alinear imagen y caption arriba.
            <figure
              key={f.id}
              className="2xl:mx-[calc((100%-min(1600px,90vw))/2)] 2xl:grid 2xl:w-[min(1600px,90vw)] 2xl:grid-cols-[minmax(32ch,38ch)_1fr] 2xl:items-start 2xl:gap-12"
            >
              <figcaption className="2xl:sticky 2xl:top-24">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)]">
                  {t.figura} {i + 1} · {c.tag}
                </p>
                <h4 className="mt-1.5 font-serif text-2xl font-bold leading-snug text-[var(--color-ink)]">
                  {headline}
                </h4>
                <p className="mt-2 max-w-3xl leading-relaxed text-[var(--color-muted)]">{c.body(d)}</p>
              </figcaption>
              <div className="min-w-0 2xl:-mt-5">
                <FigureLink
                  src={`/data/${prefix}/${f.id}.png`}
                  dim={figDim(`${prefix}/${f.id}.png`, fallback.light)}
                  alt={c.alt}
                  ariaLabel={ariaLabel}
                  hint={t.fullSize}
                  originalLabel={t.openOriginal}
                  closeLabel={t.close}
                  toggle="block dark:hidden"
                  plate="bg-[var(--color-figure-plate)]"
                />
                <FigureLink
                  src={`/data/${prefix}/dark/${f.id}.png`}
                  dim={figDim(`${prefix}/dark/${f.id}.png`, fallback.dark)}
                  alt={c.alt}
                  ariaLabel={ariaLabel}
                  hint={t.fullSize}
                  originalLabel={t.openOriginal}
                  closeLabel={t.close}
                  toggle="hidden dark:block"
                  plate="bg-[var(--color-figure-plate-dark)]"
                  imgAriaHidden
                />
              </div>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
