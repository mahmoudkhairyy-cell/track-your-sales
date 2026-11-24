import { ImageResponse } from "next/og";

// Next 16.4.6+ بيطلب ده صراحة مع output: "export".
export const dynamic = "force-static";

export const alt = "Track Your Sales — TY Fusion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(125deg, #fff7ef 0%, #fff0df 48%, #fbd0aa 100%)",
          color: "#2d1d13",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ position: "absolute", width: 620, height: 620, borderRadius: 310, right: -120, top: -250, background: "rgba(240,120,24,.12)", display: "flex" }} />
        <div style={{ position: "absolute", width: 520, height: 520, borderRadius: 260, left: -150, bottom: -300, background: "rgba(198,83,11,.10)", display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 46, padding: 72, zIndex: 1 }}>
          <div style={{ width: 220, height: 220, borderRadius: 62, background: "linear-gradient(145deg,#f58a3c,#a94309)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 60px rgba(166,76,16,.22)" }}>
            <svg width="160" height="160" viewBox="0 0 48 48">
              <path d="M7 10H41M24 10V40" stroke="white" strokeWidth="4.4" strokeLinecap="round" />
              <path d="M13 18L24 29L35 18" stroke="#FFD0A6" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="24" cy="40" r="2.2" fill="#FFD0A6" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2, color: "#2d1d13" }}>Track Your Sales</div>
            <div style={{ fontSize: 30, color: "#9a4b1d", fontWeight: 600 }}>Your targets. Your progress. Your success.</div>
            <div style={{ fontSize: 23, color: "#8c7b6e" }}>by Mahmoud Khairy</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
