import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Mono, IBM_Plex_Sans, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Meridian · Rotación Sectorial de ETFs",
  description:
    "Dashboard de monitoreo sectorial y rotación de ETFs con precios, variaciones 1D/1S/1M y sesgo macro en tiempo real.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body
        className={`${outfit.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}
      >
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
