import { ImageResponse } from "next/og";

export const alt = "Naturallyaspiratedlearn — an open-source study workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 80px", color: "#1e211b", background: "#f4f1e9", fontFamily: "serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div style={{ width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 36, color: "#f4f1e9", background: "#1f513e", fontSize: 28 }}>NA</div>
        <div style={{ display: "flex", fontFamily: "sans-serif", fontSize: 28 }}>Naturallyaspiratedlearn</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", maxWidth: 880, fontSize: 78, lineHeight: 1.02, letterSpacing: -3 }}>Build knowledge under your own power.</div>
        <div style={{ display: "flex", marginTop: 30, color: "#72766c", fontFamily: "sans-serif", fontSize: 25 }}>Why have a turbochargee when you are naturally aspirated</div>
      </div>
      <div style={{ display: "flex", width: 160, height: 5, background: "#c5683e" }} />
    </div>,
    size
  );
}
