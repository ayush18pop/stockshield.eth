import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockShield | LP Protection for Tokenized Securities",
  description: "The protection layer for tokenized stock liquidity providers. Dynamic fees, gap capture auctions, and circuit breakers powered by Uniswap v4 hooks.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "StockShield | LP Protection for Tokenized Securities",
    description: "The protection layer for tokenized stock liquidity providers. Dynamic fees, gap capture auctions, and circuit breakers powered by Uniswap v4 hooks.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "StockShield",
    description: "LP Protection for Tokenized Securities",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${spaceMono.variable} font-sans antialiased`}
      >
        <div className="fixed inset-0 -z-20 bg-[#050505]" />
        <div className="fixed inset-0 -z-10 bg-grid-pattern opacity-20 pointer-events-none" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
