"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { usePathname } from "next/navigation";
import { basePath } from "@/lib/site-map";

export function BackToTop() {
  const { lang } = useLang();
  const [show, setShow] = React.useState(false);
  // On phones the forecasts list keeps its pin buttons on the right edge, where
  // this button would sit on top of them; the list is reached by scrolling anyway.
  const onList = basePath(usePathname() || "/") === "/resultados";
  React.useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;
  return (
    <button
      type="button"
      aria-label={tr(lang, "backToTop")}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      // G2: bottom-20 — el launcher de VisaBot vive en bottom-5 right-5 z-[60] y tapaba
      // este botón (z-40) en toda página con scroll >700px; apilados verticalmente.
      className={`fixed bottom-20 right-6 z-40 ${onList ? "max-md:hidden md:inline-flex" : "inline-flex"} h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-secondary`}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  );
}
