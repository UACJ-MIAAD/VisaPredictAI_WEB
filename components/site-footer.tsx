"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { localePath } from "@/lib/site-map";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { SITE_STATS } from "@/lib/content/site-stats.generated";

const EXTERNAL = [
  { label: "Visa Bulletin", href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
  { label: "USCIS", href: "https://www.uscis.gov/" },
  { label: "UACJ", href: "https://www.uacj.mx" },
  { label: "GitHub", href: "https://github.com/UACJ-MIAAD/VisaPredictAI" },
];

// Minimal footer (AX9): brand + external references on one slim row, a hairline,
// then the copyright. The internal nav column and long blurb were dropped — the
// sticky header already carries every route, so repeating them here only added
// vertical weight. The assistant is a full-height chat app, so the footer is
// omitted there entirely (the console carries its own disclaimer).
export function SiteFooter() {
  const { lang } = useLang();
  const pathname = usePathname();
  if (pathname?.includes("/asistente")) return null;

  return (
    <footer className="footer">
      <div className="footer-top">
        {/* QW5: accessible name must match the visible text "VisaPredictAI"
            (WCAG 2.5.3 label-in-name). QW4: 2 kB logo-64 for a 22 px render. */}
        <Link href={localePath("/", lang)} className="footer-brand-row" aria-label="VisaPredictAI">
          <Image src="/logo-64.png" alt="" width={22} height={22} />
          <b>
            VisaPredict<span>AI</span>
          </b>
        </Link>
        <nav className="footer-ext" aria-label={tr(lang, "footerExternal")}>
          {EXTERNAL.map((e) => (
            <a key={e.href} href={e.href} target="_blank" rel="noopener">
              {e.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="footer-bottom">
        © 2026 Javier Augusto Rebull Saucedo · Universidad Autónoma de Ciudad
        Juárez · MIAAD
        <span className="footer-release">
          {" · "}
          {tr(lang, "footerRelease")} {SITE_STATS.releaseId} ({SITE_STATS.releaseStatus})
        </span>
      </div>
    </footer>
  );
}
