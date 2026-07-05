import { RouteHeader } from "@/components/route-header";
import { Resultados } from "@/components/sections/resultados";
import type { Lang } from "@/lib/site-map";

// Shared "forecast gallery" body, rendered under both /resultados and /en/…
// The gallery is a data-driven client section (like pronostico/historico); `lang`
// is served via LangProvider (set per-route by SiteShell), so it's marked void.
export function ResultadosPage({ lang }: { lang: Lang }) {
  void lang;
  return (
    <>
      <RouteHeader path="/resultados" />
      <Resultados />
    </>
  );
}
