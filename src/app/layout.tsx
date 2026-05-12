/**
 * Root layout. Loads the Geist font pair (sans + mono) and applies the
 * project's base background and text colour to <body>. All other styling
 * lives in `globals.css` and the per-component Tailwind classes.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "STA1000 — Interactive Statistics",
  description:
    "An interactive textbook for STA1000: read, explore, and verify your understanding with live visualisations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full`}
    >
      <body className="h-full antialiased font-sans bg-paper-grain text-[color:var(--color-ink-900)]">
        {children}
      </body>
    </html>
  );
}
