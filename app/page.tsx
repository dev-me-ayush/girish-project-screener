import { ClosingCta } from "@/components/closing-cta";
import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { Hero } from "@/components/hero";
import { Pricing } from "@/components/pricing";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Stats } from "@/components/stats";
import { Steps } from "@/components/steps";
import { Testimonials } from "@/components/testimonials";
import { TickerTape } from "@/components/ticker-tape";
import { getScreenerStocks } from "@/lib/stocks";

export default async function Home() {
  const stocks = await getScreenerStocks();

  return (
    <>
      <SiteHeader />
      <TickerTape />
      <main className="flex-1">
        <Hero stocks={stocks} />
        <Stats />
        <Features />
        <Steps />
        <Testimonials />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
