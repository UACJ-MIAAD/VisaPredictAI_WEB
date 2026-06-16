import Image from "next/image";
import Link from "next/link";
import { ROUTES } from "@/lib/site-map";

const EXTERNAL = [
  { label: "Visa Bulletin oficial", href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html" },
  { label: "USCIS", href: "https://www.uscis.gov/" },
  { label: "UACJ", href: "https://www.uacj.mx" },
  { label: "GitHub · VisaPredictAI", href: "https://github.com/UACJ-MIAAD/VisaPredictAI" },
];

export function SiteFooter() {
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
          <p>
            Sitio del proyecto VisaPredict AI · Anteproyecto de la Maestría en
            Inteligencia Artificial y Analítica de Datos (MIAAD) de la
            Universidad Autónoma de Ciudad Juárez.
          </p>
        </div>

        {ROUTES.filter((r) => r.path !== "/").map((r) => (
          <div key={r.path}>
            <h4>{r.label}</h4>
            <ul>
              {r.sections.map((s) => (
                <li key={s.id}>
                  <Link href={`${r.path}#${s.id}`}>{s.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4>Externos</h4>
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
