"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/components/lang-provider";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

// Switches locale by navigating to the mirrored URL (/x ↔ /en/x), so each
// locale is its own statically-rendered page — no flash of the wrong language.
export function LangToggle() {
  const pathname = usePathname() || "/";
  const { lang } = useLang();

  const onEn = pathname === "/en" || pathname.startsWith("/en/");
  const esHref = onEn ? pathname.replace(/^\/en/, "") || "/" : pathname;
  const enHref = onEn
    ? pathname
    : pathname === "/"
      ? "/en"
      : `/en${pathname}`;

  const items: { code: "es" | "en"; href: string }[] = [
    { code: "es", href: esHref },
    { code: "en", href: enHref },
  ];

  return (
    <div
      className="inline-flex items-center rounded-lg border border-border text-xs font-medium"
      role="group"
      aria-label="Idioma / Language"
    >
      {items.map((it) => (
        <Link
          key={it.code}
          href={it.href}
          onClick={() => lang !== it.code && track("Language Switch", { to: it.code })}
          aria-current={lang === it.code ? "true" : undefined}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-[7px] uppercase transition-colors",
            lang === it.code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {it.code}
        </Link>
      ))}
    </div>
  );
}
