import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans, Space_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";
import "./content.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "VisaPredict AI · Anteproyecto MIAAD",
    template: "%s · VisaPredict AI",
  },
  description:
    "Anteproyecto MIAAD UACJ. Predicción de fechas de prioridad en el Visa Bulletin de los Estados Unidos considerando país o área de cargabilidad, categoría migratoria y tipo de tabla. Panel multiserie y_{p,c,b,t}, metodología CRISP-DM, intervalos de predicción al 95 %.",
  applicationName: "VisaPredict AI",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/LogoVisaPredictAI.png",
    shortcut: "/LogoVisaPredictAI.png",
    apple: "/LogoVisaPredictAI.png",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1117" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${playfair.variable} ${dmSans.variable} ${spaceMono.variable} antialiased`}
      >
        {/* Progressive enhancement: mark JS-on synchronously so reveal
            animations only hide content when JS is actually running. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        {/* Structured data for rich results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: "VisaPredict AI",
                  inLanguage: ["es", "en"],
                },
                {
                  "@type": "ScholarlyArticle",
                  headline:
                    "Predicting priority dates in the U.S. Visa Bulletin by country or chargeability area, immigration category and table type",
                  isPartOf: { "@id": `${SITE_URL}/#website` },
                  inLanguage: "es",
                  author: {
                    "@type": "Person",
                    name: "Javier Augusto Rebull Saucedo",
                  },
                  publisher: {
                    "@type": "CollegeOrUniversity",
                    name: "Universidad Autónoma de Ciudad Juárez",
                  },
                  about: "U.S. Visa Bulletin priority-date forecasting (MIAAD thesis proposal)",
                },
              ],
            }),
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
