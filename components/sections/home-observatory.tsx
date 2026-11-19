"use client";

// The home page's centrepiece: the date observatory over the real panel.
// "View forecast" hands the selected series to VisaBot, which answers with the
// production forecast chart.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/components/lang-provider";
import { VisaObservatory } from "@/components/visabot/visa-observatory";
import { loadPanel, countryLabel, type Panel } from "@/lib/data/visa-panel";
import { localePath } from "@/lib/site-map";
import { track } from "@/lib/analytics";

export function forecastQuery(country: string, category: string, table: string, lang: "es" | "en") {
  const name = countryLabel(country, lang);
  return lang === "en" ? `Show the ${name} ${category} ${table} forecast` : `Muéstrame el pronóstico de ${name} ${category} ${table}`;
}

export function HomeObservatory() {
  const { lang } = useLang();
  const router = useRouter();
  const [panel, setPanel] = React.useState<Panel | null>(null);
  const [panelError, setPanelError] = React.useState(false);
  const [country, setCountry] = React.useState("mexico");
  const [category, setCategory] = React.useState("F3");
  const [table, setTable] = React.useState("FAD");

  React.useEffect(() => {
    let alive = true;
    loadPanel()
      .then((p) => {
        if (!alive) return;
        setPanel(p);
        if (!p.countries.includes("mexico")) setCountry(p.countries[0]);
        if (!p.categories.includes("F3")) setCategory(p.categories[0]);
        if (!p.tables.includes("FAD")) setTable(p.tables[0]);
      })
      .catch(() => alive && setPanelError(true));
    return () => {
      alive = false;
    };
  }, []);

  const onExplore = () => {
    track("Forecast CTA", { from: "observatory" });
    router.push(`${localePath("/asistente", lang)}/?q=${encodeURIComponent(forecastQuery(country, category, table, lang))}`);
  };

  return (
    <div className="vb-hero-composition" data-observatory-wide="true">
      <VisaObservatory
        panel={panel}
        panelError={panelError}
        country={country}
        category={category}
        table={table}
        lang={lang}
        onCountry={setCountry}
        onCategory={setCategory}
        onTable={setTable}
        onExpandedChange={() => {}}
        onExplore={onExplore}
      />
    </div>
  );
}
