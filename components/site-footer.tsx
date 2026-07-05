"use client";

import Image from "next/image";
import Link from "next/link";
import { ROUTES, rLabel, localePath } from "@/lib/site-map";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";

const EXTERNAL = [
  { label: "Visa Bulletin", href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
  { label: "USCIS", href: "https://www.uscis.gov/" },
  { label: "UACJ", href: "https://www.uacj.mx" },
  { label: "GitHub · VisaPredictAI", href: "https://github.com/UACJ-MIAAD/VisaPredictAI" },
];

// Compact footer (AW8): brand + the five top-level routes + external links.
// Per-section anchor lists were dropped — the in-page chips (RouteHeader) and
// the nav already cover them, and the one-item assistant column read as noise.
export function SiteFooter() {
  const { lang } = useLang();
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div className="footer-brand-row">
            <Image src="/LogoVisaPredictAI.png" alt="VisaPredict AI" width={30} height={30} />
            <b>
              VisaPredict<span>AI</span>
            </b>
          </div>
          <p>{tr(lang, "footerBlurb")}</p>
        </div>

        <div>
          <h4>{tr(lang, "menu")}</h4>
          <ul>
            {ROUTES.filter((r) => r.path !== "/").map((r) => (
              <li key={r.path}>
                <Link href={localePath(r.path, lang)}>{rLabel(r, lang)}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4>{tr(lang, "footerExternal")}</h4>
          <ul>
            {EXTERNAL.map((e) => (
              <li key={e.href}>
                <a href={e.href} target="_blank" rel="noopener">
                  {e.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <div>
          © 2026 Javier Augusto Rebull Saucedo · Universidad Autónoma de Ciudad
          Juárez · MIAAD
        </div>
      </div>
    </footer>
  );
}
