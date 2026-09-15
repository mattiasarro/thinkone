import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/query";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
  description: t("app.tagline"),
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 116 116'><rect width='116' height='116' rx='24' fill='%23141821'/><g transform='translate(20.8,11.6) scale(0.8)' fill='white'><path d='M0,33.06v47.14h31.79v-29.6L7.67,31.96h51.52V.17h-26.31c-.55,0-1.1.55-1.64.55L.55,31.42c0,.55-.55,1.1-.55,1.64Z'/><path d='M92.63,82.94v-47.14h-32.34v30.15l24.12,18.09h-50.97v31.79h26.31c.55,0,1.1-.55,1.64-.55l30.69-30.69s.55-1.1.55-1.64Z'/></g></svg>",
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app-router root layout applies to every page */}
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&family=Bricolage+Grotesque:opsz,wght@12..96,500..800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
