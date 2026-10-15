import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/query";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
  description: t("app.tagline"),
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 116 116'><g transform='translate(58 58) rotate(-8) scale(.88) translate(-58 -58)'><rect width='116' height='116' rx='24' fill='white'/><g transform='translate(20.8,11.6) scale(0.8)' fill='%23000000'><path d='M0,33.06v47.14h31.79v-29.6L7.67,31.96h51.52V.17h-26.31c-.55,0-1.1.55-1.64.55L.55,31.42c0,.55-.55,1.1-.55,1.64Z'/><path d='M92.63,82.94v-47.14h-32.34v30.15l24.12,18.09h-50.97v31.79h26.31c.55,0,1.1-.55,1.64-.55l30.69-30.69s.55-1.1.55-1.64Z'/></g></g></svg>",
  },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#1b1b1b" }, { media: "(prefers-color-scheme: light)", color: "#fbfbfb" }] };

/* Theme is read before the stylesheet paints (demo index.html does the same) so there is no flash; dark is the default. */
const themeInit = `try{document.documentElement.dataset.theme=localStorage.getItem("thinkone_theme")||"dark";}catch(e){document.documentElement.dataset.theme="dark";}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="et" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app-router root layout applies to every page */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&family=Inter+Tight:wght@500..800&family=Geist+Mono:wght@400..600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
