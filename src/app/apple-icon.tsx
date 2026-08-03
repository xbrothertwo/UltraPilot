import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#10251b", color: "#10251b" }}>
    <div style={{ width: 124, height: 124, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 34, background: "#d7efdd", fontSize: 54, fontWeight: 900, letterSpacing: -5 }}>UP</div>
  </div>, size);
}
