import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#07162d", color: "white" }}>
    <div style={{ width: 124, height: 124, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 34, background: "linear-gradient(145deg,#3b82f6,#1746b4)", fontSize: 54, fontWeight: 900, letterSpacing: -5 }}>UP</div>
  </div>, size);
}
