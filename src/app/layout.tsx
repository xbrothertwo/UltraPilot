import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { getThemeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "UltraPilot", template: "%s · UltraPilot" },
  description: "Dein persönliches Cockpit für Rad- und Ultracycling-Training",
  applicationName: "UltraPilot",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UltraPilot",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffafa" },
    { media: "(prefers-color-scheme: dark)", color: "#242124" },
  ],
};

const themeInitScript = getThemeInitScript();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
