import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { Attribution } from "@/components/Attribution";
import { SiteNav } from "@/components/SiteNav";
import { ToastHost } from "@/components/ToastHost";
import { modeLabel } from "@/lib/env";
import "remixicon/fonts/remixicon.css";
import "./globals.css";

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bagcheck",
  description: "Who's buying your bag? Paste a token and see who bought and sold it in the last 24 hours, from Nansen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <SiteNav />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="pt-8 pb-8">
          <div
            className="border-ticks border-t border-[var(--line)]"
            style={{ "--tick": "var(--p-green)" } as CSSProperties}
          />
          <div className="mx-auto w-full max-w-4xl px-6 pt-6">
            <Attribution mode={modeLabel()} />
          </div>
        </footer>
        <ToastHost />
      </body>
    </html>
  );
}
