import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Chakra_Petch } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ChessDuo",
  description: "Play Smarter, Together — 2v2 chess with your teammate and AI",
  applicationName: "ChessDuo",
  authors: [{ name: "ChessDuo" }],
  keywords: ["chess", "multiplayer", "2v2", "team chess", "AI chess", "online chess", "duo chess"],
  robots: { index: true, follow: true },
  openGraph: {
    title: "ChessDuo — 2v2 Chess, Together",
    description: "Play smarter, together. Coordinate moves with your teammate against AI. Compare accuracy, sync scores, and climb together.",
    type: "website",
    siteName: "ChessDuo",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChessDuo — 2v2 Chess, Together",
    description: "Play smarter, together. Coordinate moves with your teammate against AI.",
  },
  icons: {
    icon: "/loading/icon-512.webp",
    apple: "/loading/icon-512.webp",
  },
  appleWebApp: {
    capable: true,
    title: "ChessDuo",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 3,
  userScalable: true,
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra-petch",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} h-full antialiased`}
    >
      <head>
        <Script
          src="/theme-init.js"
          strategy="beforeInteractive"
        />
        <link rel="stylesheet" href="/cm-chessboard/chessboard.css" />
        <link rel="stylesheet" href="/cm-chessboard/extensions/markers/markers.css" />
        <link rel="stylesheet" href="/cm-chessboard/extensions/promotion-dialog/promotion-dialog.css" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0f1119" />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-transparent transition-colors duration-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
