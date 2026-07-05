"use client";

// AZ4 — keep VisaBot (and its transitive engine/markdown deps) OUT of the
// initial bundle of every page. SiteShell is a server component and can't use
// `ssr: false` itself, so this tiny client wrapper does the dynamic import.
// The launcher is a client-only floating button (bottom-5 right-5, z-[60]) —
// nothing is lost by skipping SSR, and the chunk loads after hydration.
import dynamic from "next/dynamic";

const VisaBot = dynamic(() => import("./visabot").then((m) => m.VisaBot), {
  ssr: false,
});

export function VisaBotLauncher() {
  return <VisaBot />;
}
