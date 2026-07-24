import type { Metadata } from "next";
import { DM_Sans, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_PROMISE } from "@/lib/brand";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-solenos-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-solenos-serif",
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: `${BRAND_TAGLINE} — ${BRAND_PROMISE}`,
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: BRAND_NAME,
    description: BRAND_TAGLINE,
    siteName: BRAND_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: BRAND_NAME,
    description: BRAND_TAGLINE,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${libreBaskerville.variable}`}>
      <body>{children}</body>
    </html>
  );
}
