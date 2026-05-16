import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import Loading from "./loading";

export const metadata: Metadata = {
  title: "ChessDuo",
  description: "Play Smarter, Together — 2v2 chess with your teammate and AI",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
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
