import type { Metadata, Viewport } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// SEO Configuration
const siteConfig = {
  name: "StockShield",
  title: "StockShield | LP Protection for Tokenized Securities",
  description: "The protection layer for tokenized stock liquidity providers. Dynamic fees, gap capture auctions, and circuit breakers powered by Uniswap v4 hooks. Protect your LP positions from toxic flow and overnight gaps.",
  url: "https://stockshield.io",
  keywords: [
    "DeFi",
    "LP protection",
    "Uniswap v4",
    "tokenized securities",
    "liquidity providers",
    "dynamic fees",
    "VPIN",
    "crypto trading",
    "AMM",
    "decentralized finance",
    "RWA",
    "real world assets",
    "tokenized stocks",
  ],
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  // Core metadata
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: "StockShield Team" }],
  creator: "StockShield",
  publisher: "StockShield",

  // Favicon & Icons - handled by file-based convention (icon.png in app folder)
  // Backup: also defined in <head> explicitly

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "StockShield - LP Protection Protocol",
      },
    ],
  },

  // Twitter/X
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    creator: "@stockshield",
    images: ["/icon.png"],
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Verification (add your IDs when ready)
  // verification: {
  //   google: "your-google-verification-code",
  // },

  // App links
  alternates: {
    canonical: siteConfig.url,
  },

  // Category
  category: "Finance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Force favicon */}
        <link rel="icon" href="/icon.png" type="image/png" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />

        {/* Structured Data / JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: siteConfig.name,
              description: siteConfig.description,
              url: siteConfig.url,
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${spaceMono.variable} font-sans antialiased`}
      >
        <div className="fixed inset-0 -z-20 bg-[#050505]" />
        <div className="fixed inset-0 -z-10 bg-grid-pattern saber-glow opacity-30 pointer-events-none" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
