import { Hero } from "@/components/sections/hero";
import { Explore } from "@/components/sections/explore";
import { SectionHTML } from "@/components/section-html";

export default function Home() {
  return (
    <>
      <Hero />
      <SectionHTML id="resumen" className="section" />
      <Explore />
      <SectionHTML id="autores" className="section" />
      <SectionHTML id="contacto" className="section section--deep" />
    </>
  );
}
