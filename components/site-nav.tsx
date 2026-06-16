"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROUTES, routeByPath } from "@/lib/site-map";
import { cn } from "@/lib/utils";

/** Reading progress + scroll-spy over the *current route's* sections. */
function usePageState(sectionIds: string[]) {
  const [active, setActive] = React.useState(sectionIds[0] ?? "");
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    setActive(sectionIds[0] ?? "");
    const els = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.3, 0.6] },
    );
    els.forEach((el) => io.observe(el));

    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [sectionIds]);

  return { active, progress };
}

export function SiteNav() {
  const pathname = usePathname();
  const route = routeByPath(pathname);
  const sectionIds = React.useMemo(
    () => route.sections.map((s) => s.id),
    [route],
  );
  const { active, progress } = usePageState(sectionIds);
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close mobile menu on route change
  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur transition-shadow",
          scrolled && "shadow-[0_2px_14px_rgba(0,0,0,0.06)]",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-[1140px] items-center gap-4 px-5">
          <Link
            href="/"
            className="flex items-center gap-2 font-serif text-lg font-extrabold"
          >
            <Image
              src="/LogoVisaPredictAI.png"
              alt="VisaPredict AI"
              width={28}
              height={28}
            />
            <span>
              VisaPredict<span className="text-[var(--color-accent)]">AI</span>
            </span>
          </Link>

          <ul className="ml-auto hidden items-center gap-1 md:flex">
            {ROUTES.filter((r) => r.path !== "/").map((r) => {
              const isActive = pathname === r.path;
              return (
                <li key={r.path}>
                  <Link
                    href={r.path}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                      isActive && "font-medium text-[var(--color-accent)]",
                    )}
                  >
                    {r.short}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="ml-auto flex items-center gap-2 md:ml-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label="Abrir menú"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-secondary"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </nav>

        <div
          className="h-0.5 bg-[var(--color-accent)] transition-[width] duration-150"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-label="Progreso de lectura"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </header>

      {/* mobile / overlay menu: routes + current route's sections */}
      <div
        className={cn(
          "fixed inset-0 z-[60] transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
        <aside
          className={cn(
            "absolute right-0 top-0 flex h-full w-[320px] max-w-[88vw] flex-col border-l border-border bg-background transition-transform duration-300",
            open ? "translate-x-0" : "translate-x-full",
          )}
          role="dialog"
          aria-label="Navegación"
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-5">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Navegación
            </span>
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-secondary"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-3">
            {ROUTES.map((r) => {
              const isCurrent = pathname === r.path;
              return (
                <div key={r.path} className="mb-1">
                  <Link
                    href={r.path}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm font-medium hover:bg-secondary",
                      isCurrent
                        ? "text-[var(--color-accent)]"
                        : "text-foreground",
                    )}
                  >
                    {r.label}
                  </Link>
                  {isCurrent && (
                    <ul className="ml-3 border-l border-border pl-2">
                      {r.sections.map((s) => (
                        <li key={s.id}>
                          <a
                            href={`#${s.id}`}
                            onClick={() => setOpen(false)}
                            aria-current={active === s.id ? "true" : undefined}
                            className={cn(
                              "block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground",
                              active === s.id &&
                                "font-medium text-foreground",
                            )}
                          >
                            {s.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>
      </div>

      {/* desktop scroll-spy rail for the current route (xl only) */}
      {route.sections.length > 1 && (
        <nav
          aria-label="Secciones de la página"
          className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 xl:block"
        >
          <ul className="flex flex-col gap-2">
            {route.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="group flex items-center gap-2" title={s.label}>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full bg-border transition-all",
                      active === s.id && "h-2.5 w-2.5 bg-[var(--color-accent)]",
                    )}
                  />
                  <span
                    className={cn(
                      "pointer-events-none whitespace-nowrap text-xs opacity-0 transition-opacity group-hover:opacity-100",
                      active === s.id
                        ? "text-foreground opacity-100"
                        : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
