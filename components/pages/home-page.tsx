import { Hero } from "@/components/sections/hero";
import { Explore } from "@/components/sections/explore";
import { SectionHTML } from "@/components/section-html";
import type { Lang } from "@/lib/site-map";

// Shared home body, rendered under both / and /en.
export function HomePage({ lang }: { lang: Lang }) {
  return (
    <>
      <Hero />
      <SectionHTML id="resumen" lang={lang} className="section" />
      <Explore />
      <SectionHTML id="autores" lang={lang} className="section" />
      <SectionHTML id="contacto" lang={lang} className="section section--deep" />
    </>
  );
}
