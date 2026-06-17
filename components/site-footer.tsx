"use client";

import Image from "next/image";
import Link from "next/link";
import { ROUTES, rLabel, sLabel, localePath } from "@/lib/site-map";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";

const EXTERNAL = [
  { label: "Visa Bulletin", href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
  { label: "USCIS", href: "https://www.uscis.gov/" },
  { label: "UACJ", href: "https://www.uacj.mx" },
  { label: "GitHub · VisaPredictAI", href: "https://github.com/UACJ-MIAAD/VisaPredictAI" },
];

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

        {ROUTES.filter((r) => r.path !== "/").map((r) => (
          <div key={r.path}>
            <h4>{rLabel(r, lang)}</h4>
            <ul>
              {r.sections.map((s) => (
                <li key={s.id}>
                  <Link href={`${localePath(r.path, lang)}#${s.id}`}>
                    {sLabel(s, lang)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

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
