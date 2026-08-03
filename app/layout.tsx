import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const brandDisplayFont = Cormorant_Garamond({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-brand-display",
  weight: ["500", "600"],
});

const brandInterfaceFont = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-brand-interface",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Scrap the Day",
  description: "Write the feeling. Scrap the day. Seal it in your journal.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#42362f",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={`${brandDisplayFont.variable} ${brandInterfaceFont.variable}`}
      lang="en"
    >
      <body>{children}</body>
    </html>
  );
}
