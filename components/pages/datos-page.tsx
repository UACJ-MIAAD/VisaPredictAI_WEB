import { RouteHeader } from "@/components/route-header";
import { Boletines } from "@/components/sections/boletines";
import { Pronostico } from "@/components/sections/pronostico";
import { Historico } from "@/components/sections/historico";
import { Scorecard } from "@/components/sections/scorecard";

// Shared "historical data" body, rendered under both /datos-historicos and /en/...
// Order mirrors lib/site-map.ts: boletines → pronostico → historico → scorecard.
// (#eda and #fe moved to /ingenieria, AW2.)
export function DatosPage() {
  return (
    <>
      <RouteHeader path="/datos-historicos" />
      <Boletines />
      <Pronostico />
      <Historico />
      <Scorecard />
    </>
  );
}
