"use client";

// Static export emits a single out/404.html that Netlify serves for every miss in
// BOTH locales, so the language is resolved client-side from the requested path
// (the root layout's inline script already fixes <html lang> pre-paint the same way).
import * as React from "react";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { ROUTES, rLabel, localePath, type Lang } from "@/lib/site-map";

const T = {
  es: {
    code: "404",
    title: "Página no encontrada",
    body: "La dirección que buscas no existe o cambió de lugar. Estas rutas sí existen:",
    home: "Volver al inicio",
  },
  en: {
    code: "404",
    title: "Page not found",
    body: "The address you are looking for does not exist or has moved. These routes do exist:",
    home: "Back to home",
  },
};

export default function NotFound() {
  const [lang, setLang] = React.useState<Lang>("es");
  React.useEffect(() => {
    if (/^\/en(\/|$)/.test(window.location.pathname)) setLang("en");
  }, []);
  const t = T[lang];
  return (
    <SiteShell lang={lang}>
      <section className="section">
        <div className="section-inner">
          <span className="section-tag">{t.code}</span>
          <h1 className="section-title">{t.title}</h1>
          <p className="section-sub">{t.body}</p>
          <ul className="mt-6 space-y-2">
            {ROUTES.map((r) => (
              <li key={r.path}>
                <Link
                  href={localePath(r.path, lang)}
                  className="font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
                >
                  {rLabel(r, lang)}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8">
            <Link
              href={localePath("/", lang)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-medium transition-colors hover:border-[var(--color-accent-2)]"
            >
              ← {t.home}
            </Link>
          </p>
        </div>
      </section>
    </SiteShell>
  );
}
