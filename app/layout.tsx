import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter, IBM_Plex_Mono } from "next/font/google";
import { ThemeLangProvider } from "@/components/layout/ThemeLangProvider";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Silicon Waha Utilities Portal",
  description: "Utility meter reading and monitoring for the Silicon Waha Technology Park.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SW Utilities",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#003C70",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-theme="dark" suppressHydrationWarning>
      <body
        data-theme="dark"
        className={`${display.variable} ${body.variable} ${mono.variable} font-body antialiased`}
        suppressHydrationWarning
      >
        <ThemeLangProvider>{children}</ThemeLangProvider>
      </body>
    </html>
  );
}
