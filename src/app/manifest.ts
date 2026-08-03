import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UltraPilot · Road to RAG 2028",
    short_name: "UltraPilot",
    description: "Dein persönliches Cockpit für Rad- und Ultracycling-Training.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f2f1eb",
    theme_color: "#10251b",
    orientation: "any",
    categories: ["fitness", "sports", "productivity"],
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Heute", short_name: "Heute", url: "/dashboard" },
      { name: "Trainingsplan", short_name: "Plan", url: "/plan" },
      { name: "Aktivität importieren", short_name: "Import", url: "/activities/upload" },
    ],
  };
}
