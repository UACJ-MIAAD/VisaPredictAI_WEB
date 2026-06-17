import { ImageResponse } from "next/og";

// Branded 1200×630 social card, auto-wired by Next as og:image + twitter:image.
// Satori rule: every element with >1 child must declare display:flex.
export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "VisaPredict AI — predicting U.S. Visa Bulletin priority dates";

export default function OpengraphImage() {
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
          ANTEPROYECTO MIAAD · UACJ
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 78, fontWeight: 800, lineHeight: 1.04 }}>
            Predicting priority dates in the U.S.
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
            Visa Bulletin
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
            Multi-series panel · CRISP-DM · 95% prediction intervals
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
    { ...size },
  );
}
