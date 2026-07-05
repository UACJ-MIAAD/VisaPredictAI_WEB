import { LangProvider } from "@/components/lang-provider";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { NextPart } from "@/components/next-part";
import { BackToTop } from "@/components/back-to-top";
import { ClientEnhancements } from "@/components/client-enhancements";
import { HashRescroll } from "@/components/hash-rescroll";
import { VisaBotLauncher } from "@/components/visabot/visabot-launcher";
import type { Lang } from "@/lib/site-map";

// Per-locale shell: fixes the language for everything inside (chrome + content),
// so each locale's pages are server-rendered in the right language (zero flash).
export function SiteShell({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return (
    <LangProvider lang={lang}>
      <a href="#main-content" className="skip-link">
        {lang === "en" ? "Skip to content" : "Saltar al contenido"}
      </a>
      <SiteNav />
      <main id="main-content" tabIndex={-1} className="pt-16">
        {children}
        <NextPart />
      </main>
      <SiteFooter />
      <BackToTop />
      <ClientEnhancements />
      <HashRescroll />
      {/* AZ4: dynamically imported (ssr:false) so the bot stays out of First Load */}
      <VisaBotLauncher />
    </LangProvider>
  );
}
