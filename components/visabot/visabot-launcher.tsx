"use client";

// Floating shortcut to VisaBot. The chat lives in one place, /asistente, where
// answers can carry charts; this is just a link to it, hidden there and on the
// home page (which has its own question box).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { basePath, localePath } from "@/lib/site-map";
import { track } from "@/lib/analytics";

export function VisaBotLauncher() {
  const { lang } = useLang();
  const base = basePath(usePathname() || "/");
  if (base === "/asistente" || base === "/") return null;
  return (
    <Link
      href={localePath("/asistente", lang)}
      aria-label={tr(lang, "vbOpen")}
      onClick={() => track("VisaBot Launcher", { from: base })}
      className="vb-launcher fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-full bg-[var(--color-accent-btn)] px-4 py-3 text-white shadow-lg transition hover:brightness-110"
    >
      <Sparkles className="h-5 w-5" aria-hidden />
      <span className="hidden text-sm font-medium sm:inline">{tr(lang, "vbLauncher")}</span>
    </Link>
  );
}
