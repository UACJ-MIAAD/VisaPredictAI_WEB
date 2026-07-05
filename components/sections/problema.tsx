// Server component: "the problem, in one figure" (home, AU1). Shows the EDA
// gallery's hero figure G1 — the full panel's regime map — reusing the same
// language × theme <img> pattern as eda-gallery.tsx (FigureLink): both theme
// variants live in the DOM and CSS-toggle via the `dark:` class, the language
// is fixed by the route, and dimensions come from the build-measured
// /data/fig_dims.json (the constants below are only the fallback, mirroring
// eda-gallery's). The only number in the copy is SITE_STATS.nMonths — derived
// at build, never typed by hand (regla #0).

import { FigureLink } from "@/components/sections/eda-gallery";
import { SITE_STATS } from "@/lib/content/site-stats.generated";
import { figDim, type Dim } from "@/lib/data/fig-dims";
import { tr, localeOf } from "@/lib/i18n";
import type { Lang } from "@/lib/site-map";

// Fallback intrinsic dims for g01_panel (same values as eda-gallery's FIGS).
const FALLBACK: Record<Lang, Dim> = {
  es: { w: 2652, h: 3509 },
  en: { w: 2679, h: 3509 },
};

export function Problema({ lang }: { lang: Lang }) {
  const n = SITE_STATS.nMonths.toLocaleString(localeOf(lang));
  const prefix = lang === "en" ? "eda/en" : "eda";
  const alt = tr(lang, "probAlt");
  const hint = tr(lang, "probFullSize");
  const ariaLabel = `${tr(lang, "probTitle")} — ${hint}`;
  return (
    <section id="problema" className="section section--alt">
      <div className="section-inner">
        <span className="section-tag">{tr(lang, "probTag")}</span>
        <h2 className="section-title">{tr(lang, "probTitle")}</h2>
        <p className="section-sub">{tr(lang, "probBody").replace("{n}", n)}</p>

        <div className="max-w-3xl">
          <FigureLink
            src={`/data/${prefix}/g01_panel.png`}
            dim={figDim(`${prefix}/g01_panel.png`, FALLBACK[lang])}
            alt={alt}
            ariaLabel={ariaLabel}
            hint={hint}
            toggle="block dark:hidden"
            plate="bg-[var(--color-figure-plate)]"
          />
          <FigureLink
            src={`/data/${prefix}/dark/g01_panel.png`}
            dim={figDim(`${prefix}/dark/g01_panel.png`, FALLBACK[lang])}
            alt={alt}
            ariaLabel={ariaLabel}
            hint={hint}
            toggle="hidden dark:block"
            plate="bg-[var(--color-figure-plate-dark)]"
            imgAriaHidden
          />
        </div>
      </div>
    </section>
  );
}
