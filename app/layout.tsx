import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";
import "./content.css";
import "./font-fallbacks.css";

// AZ7 — weights trimmed to what the repo actually uses (audited via grep):
// Playfair 700 (font-bold serif) / 800 (font-extrabold, CSS 800) / 900
// (font-black hero). Italic was loaded but NO serif element renders <em> —
// dropped (3 font files). DM Sans 300 (font-light) had zero uses — dropped.
// Versioned, byte-identical Latin assets remove build-time Google requests.
// Sources and redistribution licenses live beside the fonts.
const playfair = localFont({
  src: "./fonts/playfair-display-latin.woff2",
  weight: "700 900",
  style: "normal",
  adjustFontFallback: false,
  fallback: ["Playfair Display Fallback"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = localFont({
  src: "./fonts/dm-sans-latin.woff2",
  weight: "400 700",
  style: "normal",
  adjustFontFallback: false,
  fallback: ["DM Sans Fallback"],
  variable: "--font-dm",
  display: "swap",
});

const spaceMono = localFont({
  src: [
    { path: "./fonts/space-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/space-mono-latin-700.woff2", weight: "700", style: "normal" },
  ],
  adjustFontFallback: false,
  fallback: ["Space Mono Fallback"],
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
  // AZ3b — purpose-built icons from scripts/build-icons.mjs (the 256 kB master
  // logo is no longer referenced as an icon; /favicon.ico is a 2 kB 32px ICO).
  icons: {
    icon: [
      { url: "/logo-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/logo-64.png",
    apple: "/apple-touch-icon.png",
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
            animations only hide content when JS is actually running.
            G1: same sync script fixes <html lang> for /en/* BEFORE paint —
            the static export hardcodes lang="es" and the LangProvider effect
            only corrected it post-hydration (screen readers announced English
            content as Spanish). hreflang/canonical cover no-JS crawlers. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');if(location.pathname==='/en'||location.pathname.indexOf('/en/')===0)document.documentElement.lang='en'",
          }}
        />
        {/* BA7: the JSON-LD structured data moved to the per-locale layouts
            (app/(es)/layout.tsx and app/en/layout.tsx) so inLanguage and the
            canonical URL match each locale — see siteJsonLd() in lib/seo.ts. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        {/* Privacy-friendly analytics by Plausible (account-specific snippet).
            Custom events use window.plausible(...) — see lib/analytics.ts. */}
        <Script
          async
          src="https://plausible.io/js/pa-dIWwVEybhoUGRkq9GHkEY.js"
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()",
          }}
        />
      </body>
    </html>
  );
}
