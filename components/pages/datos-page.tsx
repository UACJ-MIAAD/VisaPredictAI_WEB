import { RouteHeader } from "@/components/route-header";
import { Boletines } from "@/components/sections/boletines";
import { Historico } from "@/components/sections/historico";
import { Scorecard } from "@/components/sections/scorecard";

// Shared "historical data" body, rendered under both /datos-historicos and /en/...
export function DatosPage() {
  return (
    <>
      <RouteHeader path="/datos-historicos" />
      <Boletines />
      <Scorecard />
      <Historico />
    </>
  );
}
