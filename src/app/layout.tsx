import type { Metadata } from "next";
import "./globals.css";
import "./accessibility-overrides.css";
import "./mobile-app.css";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_PROMISE } from "@/lib/brand";



export const metadata: Metadata = {
  metadataBase: new URL("https://solenosai.netlify.app"),
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
    <html lang="en" className="solenos-font-fallbacks">
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://solenosbackend-production.up.railway.app" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//images.unsplash.com" />
        <link rel="dns-prefetch" href="//solenosbackend-production.up.railway.app" />
      </head>
      <body>{children}</body>
    </html>
  );
}
