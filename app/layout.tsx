import type { Metadata } from "next";
import {
  Geist,
  Instrument_Serif,
  JetBrains_Mono,
  Mukta,
  Tiro_Devanagari_Hindi,
} from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

/* Instrument Serif and Geist carry no Devanagari glyphs, so the Hindi copy
   needs a real fallback rather than whatever the OS happens to have. */
const mukta = Mukta({
  variable: "--font-mukta",
  subsets: ["devanagari", "latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const tiro = Tiro_Devanagari_Hindi({
  variable: "--font-tiro",
  subsets: ["devanagari", "latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tessera.example"),
  title: {
    default: "Tessera — the stock scanner for people who read tickers",
    template: "%s · Tessera",
  },
  description:
    "Screen 9,400+ US equities in under 400ms. Build reusable presets, layer on fundamentals and sentiment, and get alerts the moment a setup prints.",
  openGraph: {
    type: "website",
    siteName: "Tessera",
    title: "Tessera — the stock scanner for people who read tickers",
    description:
      "Screen 9,400+ US equities in under 400ms. Build reusable presets, layer on fundamentals and sentiment, and get alerts the moment a setup prints.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tessera — the stock scanner for people who read tickers",
    description:
      "Screen 9,400+ US equities in under 400ms. Build reusable presets, layer on fundamentals and sentiment, and get alerts the moment a setup prints.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geist.variable} ${instrument.variable} ${jetbrains.variable} ${mukta.variable} ${tiro.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden">{children}</body>
    </html>
  );
}
