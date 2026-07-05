import { ImageResponse } from "next/og";

// BA7 — shared 1200×630 social-card template. Every route segment ships a thin
// opengraph-image.tsx (ES under app/(es)/*, EN under app/en/*) that calls
// ogCard() with its own title, so link previews name the page instead of
// always showing the generic home card.
// Satori rule: every element with >1 child must declare display:flex.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const SUB = {
  es: "Panel multiserie · CRISP-DM · Intervalos de predicción al 95 %",
  en: "Multi-series panel · CRISP-DM · 95% prediction intervals",
};

export function ogCard({
  lang,
  title,
  accent = "U.S. Visa Bulletin",
  sub,
}: {
  lang: "es" | "en";
  title: string;
  accent?: string;
  sub?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a1330",
          padding: "80px",
          color: "#ffffff",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 28,
            letterSpacing: 4,
            color: "#7fb0ff",
            fontFamily: "monospace",
          }}
        >
          <div style={{ width: 56, height: 4, background: "#7fb0ff", marginRight: 18 }} />
          {lang === "en" ? "MIAAD THESIS PROPOSAL · UACJ" : "ANTEPROYECTO MIAAD · UACJ"}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 78, fontWeight: 800, lineHeight: 1.04 }}>
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              fontWeight: 800,
              fontStyle: "italic",
              color: "#7fb0ff",
              lineHeight: 1.1,
            }}
          >
            {accent}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 30,
              color: "#b8c2d9",
              fontFamily: "sans-serif",
            }}
          >
            {sub ?? SUB[lang]}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", fontWeight: 700, color: "#ffffff" }}>VisaPredict AI</div>
          <div style={{ display: "flex", color: "#8a96b4" }}>visapredictai.com</div>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
