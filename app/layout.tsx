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
  metadataBase: new URL("https://eizeujhpgz.ap-south-1.awsapprunner.com"),
  title: {
    default: "Girish Screener — 1-minute NSE Fibonacci AC/DC breakout scanner",
    template: "%s · Girish Screener",
  },
  description:
    "Live 1-minute NSE equity and index-options scanner on Fibonacci AC/DC 38.2% breakout levels, in rupees, in IST.",
  openGraph: {
    type: "website",
    siteName: "Girish Screener",
    title: "Girish Screener — 1-minute NSE Fibonacci AC/DC breakout scanner",
    description:
      "Live 1-minute NSE equity and index-options scanner on Fibonacci AC/DC 38.2% breakout levels, in rupees, in IST.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Girish Screener — 1-minute NSE Fibonacci AC/DC breakout scanner",
    description:
      "Live 1-minute NSE equity and index-options scanner on Fibonacci AC/DC 38.2% breakout levels, in rupees, in IST.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

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
