"use client";

// Minimal header (redesign 19-nov-2026): logo · four primary routes · language
// and theme · a menu button on small screens. No in-page subnav, no progress
// bar. Items derive from lib/nav-model (pure, unit-tested).

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { localePath, basePath } from "@/lib/site-map";
import { mastheadItems, secondaryItems } from "@/lib/nav-model";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { track } from "@/lib/analytics";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const pathname = usePathname();
  const { lang } = useLang();
  const base = basePath(pathname);
  const primary = React.useMemo(() => mastheadItems(base, lang), [base, lang]);
  const secondary = React.useMemo(() => secondaryItems(base, lang), [base, lang]);
  const [open, setOpen] = React.useState(false);

  const drawerRef = useFocusTrap<HTMLElement>(open);
  const openBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const wasOpen = React.useRef(false);
  React.useEffect(() => {
    if (wasOpen.current && !open) openBtnRef.current?.focus();
    wasOpen.current = open;
  }, [open]);
  React.useEffect(() => setOpen(false), [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const release = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      release();
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header className="site-header sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[var(--container)] items-center gap-2 px-5 sm:gap-4">
          <Link
            href={localePath("/", lang)}
            aria-current={base === "/" ? "page" : undefined}
            className="flex shrink-0 items-center gap-2 text-[1.05rem] font-semibold tracking-tight"
          >
            <Image src="/logo-64.png" alt="VisaPredict AI" width={26} height={26} />
            <span className="max-[399px]:hidden">
              VisaPredict<span className="text-[var(--color-accent)]">AI</span>
            </span>
          </Link>

          <nav aria-label={tr(lang, "navPrimary")} className="ml-auto hidden md:block">
            <ul className="flex items-center gap-1">
              {primary.map((it) => {
                const bot = it.path === "/asistente";
                return (
                  <li key={it.path}>
                    <Link
                      href={it.href}
                      aria-current={it.active ? "page" : undefined}
                      onClick={() => track("Nav", { level: "global", to: it.path, ui: "masthead" })}
                      className={cn(
                        "whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors",
                        bot
                          ? "ml-2 bg-[var(--color-accent-btn)] font-medium text-white hover:opacity-90"
                          : "text-muted-foreground hover:text-foreground",
                        it.active && !bot && "text-foreground",
                      )}
                    >
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 md:ml-3">
            <LangToggle />
            <ThemeToggle />
            <button
              type="button"
              ref={openBtnRef}
              aria-label={tr(lang, "openMenu")}
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary md:hidden"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn("fixed inset-0 z-[60] overflow-hidden transition-opacity", open ? "opacity-100" : "pointer-events-none opacity-0")}
        inert={!open ? true : undefined}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
        <aside
          ref={drawerRef}
          className={cn(
            "absolute right-0 top-0 flex h-full w-[300px] max-w-[86vw] flex-col bg-background transition-transform duration-300",
            open ? "translate-x-0" : "translate-x-full",
          )}
          role="dialog"
          aria-modal="true"
          aria-label={tr(lang, "menu")}
        >
          <div className="flex h-16 items-center justify-end px-4">
            <button
              type="button"
              aria-label={tr(lang, "closeMenu")}
              onClick={() => setOpen(false)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-secondary"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <nav aria-label={tr(lang, "navPrimary")} className="flex-1 overflow-y-auto px-5 pb-8">
            <ul className="space-y-1">
              {[...primary, ...secondary].map((it, i) => (
                <li key={it.path} className={i === primary.length ? "mt-5 border-t border-border pt-5" : undefined}>
                  <Link
                    href={it.href}
                    aria-current={it.active ? "page" : undefined}
                    onClick={() => {
                      setOpen(false);
                      track("Nav", { level: "global", to: it.path, ui: "drawer" });
                    }}
                    className={cn(
                      "block py-2",
                      i < primary.length ? "text-xl font-medium" : "text-sm text-muted-foreground",
                      it.active && "text-[var(--color-accent)]",
                    )}
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
    </>
  );
}
