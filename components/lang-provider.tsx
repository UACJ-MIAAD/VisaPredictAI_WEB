"use client";

import * as React from "react";
import type { Lang } from "@/lib/site-map";

// Language is determined by the route (/ = es, /en = en), so it is fixed per
// render — no client state, no flash. The provider just exposes it + keeps the
// <html lang> attribute in sync for screen readers.
const LangContext = React.createContext<{ lang: Lang }>({ lang: "es" });

export function LangProvider({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return (
    <LangContext.Provider value={{ lang }}>{children}</LangContext.Provider>
  );
}

export const useLang = () => React.useContext(LangContext);
