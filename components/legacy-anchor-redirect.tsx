"use client";

// AW2 moved #eda/#fe from /datos-historicos to /ingenieria. Fragments never
// reach the server, so old bookmarks/shared links can only be honored
// client-side: mounted on /datos-historicos, this forwards them to the new home.
import * as React from "react";
import { useLang } from "@/components/lang-provider";
import { localePath } from "@/lib/site-map";

const MOVED = new Set(["#eda", "#fe"]);

export function LegacyAnchorRedirect() {
  const { lang } = useLang();
  React.useEffect(() => {
    const h = window.location.hash;
    if (MOVED.has(h)) window.location.replace(localePath("/ingenieria", lang) + "/" + h);
  }, [lang]);
  return null;
}
