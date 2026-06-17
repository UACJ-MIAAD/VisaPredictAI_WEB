import type { Metadata } from "next";
import { Playfair_Display, DM_Sans, Space_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
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
  title: "VisaPredict AI · Anteproyecto MIAAD",
  description:
    "Anteproyecto MIAAD UACJ. Predicción de fechas de prioridad en el Visa Bulletin de los Estados Unidos considerando país o área de cargabilidad, categoría migratoria y tipo de tabla. Panel multiserie y_{p,c,b,t}, metodología CRISP-DM, intervalos de predicción al 95 %.",
  icons: { icon: "/LogoVisaPredictAI.png" },
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
