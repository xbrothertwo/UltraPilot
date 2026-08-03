import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", background: "#07162d", color: "white" }}>
    <div style={{ position: "absolute", width: 410, height: 410, right: -160, top: -160, borderRadius: 999, border: "64px solid rgba(56,189,248,.14)" }}/>
    <div style={{ width: 320, height: 320, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 92, background: "linear-gradient(145deg,#3b82f6,#1746b4)", boxShadow: "0 34px 80px rgba(0,0,0,.32)", fontSize: 132, fontWeight: 900, letterSpacing: -12 }}>UP</div>
  </div>, size);
}
