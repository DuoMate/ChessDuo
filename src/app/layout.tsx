import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Chakra_Petch } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import Loading from "./loading";

export const metadata: Metadata = {
  title: "ChessDuo",
  description: "Play Smarter, Together — 2v2 chess with your teammate and AI",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      className={`${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=JSON.parse(localStorage.getItem('chessduo_settings')||'{}').theme;if(!t||t==='dark')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`,
          }}
        />
        <link rel="stylesheet" href="/cm-chessboard/chessboard.css" />
        <link rel="stylesheet" href="/cm-chessboard/extensions/markers/markers.css" />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <Suspense fallback={<Loading />}>
            {children}
          </Suspense>
        </ToastProvider>
      </body>
    </html>
  );
}
