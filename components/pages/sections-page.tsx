import Link from "next/link";
import { ProseFold } from "@/components/prose-fold";
import { RouteHeader } from "@/components/route-header";
import { SectionHTML } from "@/components/section-html";
import { Eda } from "@/components/sections/eda";
import { Fe } from "@/components/sections/fe";
import { Descargas } from "@/components/sections/descargas";
import { tr } from "@/lib/i18n";
import { localePath, rLabel, routeByPath, sectionClass, type Lang } from "@/lib/site-map";

// Live (client) sections that replace the static SectionHTML for their id.
// eda/fe moved here from /datos-historicos (AW2): the components fetch their
// own census JSON and keep their internal <section id="eda">/<section id="fe">.
// They defer their heavy libs internally (same as when datos-page mounted them
// via direct import), so no extra dynamic() wrapper is needed here.
const LIVE: Record<string, React.ComponentType> = { eda: Eda, fe: Fe };

// Shared body for the section-list routes (proposal / engineering / resources),
// rendered under both / and /en — language is passed from the locale page.
export function SectionsPage({ path, lang }: { path: string; lang: Lang }) {
  const route = routeByPath(path);
  return (
    <>
      <RouteHeader path={path} />
      {path === "/anteproyecto" && (
        // AU4: temporal-context banner — the proposal is a frozen May-2026
        // document; the living results moved to /datos-historicos.
        // (AY1: rail width via var(--container), not a literal, so the banner
        // widens in lockstep with the 2xl rail.)
        <div className="mx-auto w-full max-w-[var(--container)] px-5">
          <aside className="mt-6 border-l-2 border-[var(--color-accent)] pl-4 text-sm leading-relaxed text-muted-foreground">
            {tr(lang, "anteBannerPre")}{" "}
            <Link
              href={localePath("/datos-historicos", lang)}
              className="font-medium text-[var(--color-accent)] underline underline-offset-2"
            >
              {rLabel(routeByPath("/datos-historicos"), lang)}
            </Link>
            .
          </aside>
        </div>
      )}
      {path === "/anteproyecto" && (
        // AW5: reading layer — fold each frozen chapter after its .section-sub
        // lead (open on desktop, collapsed on phones; deep links auto-open).
        // Applied ONLY to /anteproyecto: /ingenieria mixes live client
        // sections (#eda/#fe render their own DOM, not the extractor shape)
        // and its #estructura/#modelo anchors are reference material that is
        // deep-linked constantly — folding there is more fragile than useful.
        <ProseFold
          ids={routeByPath(path).sections.map((s) => s.id)}
          moreLabel={lang === "en" ? "Read the full section" : "Leer la sección completa"}
          lessLabel={lang === "en" ? "Collapse the section" : "Contraer la sección"}
        />
      )}
      {route.sections.map((s, i) => {
        const Live = LIVE[s.id];
        if (Live) return <Live key={s.id} />;
        if (s.id === "descargas")
          return <Descargas key={s.id} lang={lang} className={sectionClass(i, s.id)} />;
        return (
          <SectionHTML key={s.id} id={s.id} lang={lang} className={sectionClass(i, s.id)} />
        );
      })}
    </>
  );
}
