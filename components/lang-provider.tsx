"use client";

import * as React from "react";
import type { Lang } from "@/lib/site-map";

type Ctx = { lang: Lang; setLang: (l: Lang) => void };
const LangContext = React.createContext<Ctx>({ lang: "es", setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("es");

  // hydrate from storage / browser once mounted
  React.useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "es" || saved === "en") setLangState(saved);
    else if (navigator.language?.toLowerCase().startsWith("en")) setLangState("en");
  }, []);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("lang", l);
    document.documentElement.lang = l;
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => React.useContext(LangContext);
