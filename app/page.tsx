import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { getScreenerStocks } from "@/lib/stocks";

export const dynamic = "force-dynamic";

export default async function Home() {
  const stocks = await getScreenerStocks();

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-paper selection:bg-paper selection:text-ink antialiased">
      <SiteHeader />
      <main className="flex flex-1 flex-col justify-center">
        <Hero stocks={stocks} />
      </main>
    </div>
  );
}

