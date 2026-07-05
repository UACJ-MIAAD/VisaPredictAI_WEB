import { RouteHeader } from "@/components/route-header";
import { Boletines } from "@/components/sections/boletines";
import { Pronostico } from "@/components/sections/pronostico";
import { Historico } from "@/components/sections/historico";
import { Scorecard } from "@/components/sections/scorecard";
import { LegacyAnchorRedirect } from "@/components/legacy-anchor-redirect";
import type { Lang } from "@/lib/site-map";

// Shared "historical data" body, rendered under both /datos-historicos and /en/...
// Order mirrors lib/site-map.ts: boletines → pronostico → historico → scorecard.
// (#eda and #fe moved to /ingenieria, AW2.)
//
// `lang` keeps the page-body API consistent with HomePage/SectionsPage (the
// locale routes pass it the same way). Every child here is a client component
// that reads the same value from LangProvider (set per-route by SiteShell), so
// no explicit threading is needed — the `void` marks the prop as intentionally
// context-served rather than unused.
export function DatosPage({ lang }: { lang: Lang }) {
  void lang;
  return (
    <>
      <LegacyAnchorRedirect />
      <RouteHeader path="/datos-historicos" />
      <Boletines />
      <Pronostico />
      <Historico />
      <Scorecard />
    </>
  );
}
