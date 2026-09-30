"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { SymbolFibAnalysis } from "@/lib/scanner";
import {
  ChartBarIcon,
  RefreshIcon,
  SearchIcon,
  XIcon,
  ClockIcon,
  ChevronDownIcon,
} from "@/components/icons";
import { InfoTooltip } from "@/components/info-tooltip";

interface EquitySearchResult {
  symbol: string;
  name: string;
  instrument_key: string;
  sector?: string;
}

const TIMEFRAME_OPTIONS = ["1m", "2m", "3m", "5m", "15m"] as const;
type TimeframeOption = (typeof TIMEFRAME_OPTIONS)[number];

export function FibonacciTerminal() {
  const [selectedStock, setSelectedStock] = useState<EquitySearchResult | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>("1m");
  const [symbolAnalysis, setSymbolAnalysis] = useState<SymbolFibAnalysis | null>(null);
  const [isLoadingSymbol, setIsLoadingSymbol] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Timeframe Popover
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
  const timeframeRef = useRef<HTMLDivElement>(null);

  // Search Modal
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [isSearchingDb, setIsSearchingDb] = useState(false);
  const [searchResults, setSearchResults] = useState<EquitySearchResult[]>([]);

  // Close timeframe popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (timeframeRef.current && !timeframeRef.current.contains(e.target as Node)) {
        setIsTimeframeOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch symbol analysis from API
  const fetchAnalysis = useCallback(async (stock: EquitySearchResult, isBackgroundRefresh = false) => {
    if (isBackgroundRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingSymbol(true);
    }

    try {
      const url = `/api/scanner/symbol?symbol=${encodeURIComponent(stock.symbol)}&instrumentKey=${encodeURIComponent(
        stock.instrument_key
      )}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();

      if (data.status === "success" && data.analysis) {
        setSymbolAnalysis(data.analysis);
      }
    } catch (err) {
      console.error("Failed to load symbol analysis:", err);
    } finally {
      setIsLoadingSymbol(false);
      setIsRefreshing(false);
    }
  }, []);

  // When a symbol is picked from the modal
  const handleSelectStock = useCallback((stock: EquitySearchResult) => {
    setSelectedStock(stock);
    setIsSearchModalOpen(false);
    setModalSearchQuery("");
    setSearchResults([]);
    fetchAnalysis(stock);
  }, [fetchAnalysis]);

  // Debounced search for stocks in Neon DB
  useEffect(() => {
    const q = modalSearchQuery.trim();
    if (!q) return;

    let isCancelled = false;
    const timer = setTimeout(async () => {
      setIsSearchingDb(true);
      try {
        const res = await fetch(`/api/instruments/equities?q=${encodeURIComponent(q)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!isCancelled && data.status === "success") {
          setSearchResults(data.stocks || []);
        }
      } catch (err) {
        console.error("Equity search error:", err);
      } finally {
        if (!isCancelled) setIsSearchingDb(false);
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [modalSearchQuery]);

  // Current breakout evaluation for the selected timeframe
  const currentBreakout = symbolAnalysis
    ? symbolAnalysis.timeframeBreakouts[selectedTimeframe]
    : null;

  return (
    <div className="flex flex-col w-full flex-1 min-h-[calc(100dvh-3.5rem)] bg-ink relative">
      {/* 1. Edge-to-Edge Top Control Bar (matching Watchlists layout) */}
      <div className="flex h-12 w-full items-center justify-between border-b border-zinc-800 bg-ink px-4 sm:px-6 shrink-0">
        {/* Left: Search Symbol Trigger + Active Symbol Meta + Timeframe */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Search Symbol Button */}
          <button
            type="button"
            onClick={() => {
              setIsSearchModalOpen(true);
              setModalSearchQuery("");
              setSearchResults([]);
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-paper px-3 text-xs font-mono font-bold text-ink hover:bg-zinc-200 transition-all shrink-0 shadow-xs"
          >
            <SearchIcon className="h-3.5 w-3.5" />
            <span>Search Symbol</span>
          </button>

          {selectedStock && (
            <>
              <span className="h-3 w-px bg-zinc-800 shrink-0" />

              {/* Active Symbol Display */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-sans font-bold text-paper truncate">
                  {selectedStock.symbol}
                </span>
                <span className="hidden md:inline-block text-xs font-mono text-zinc-400 truncate max-w-44">
                  {selectedStock.name}
                </span>
                {selectedStock.sector && (
                  <span className="hidden sm:inline-block text-[9px] font-mono border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-400">
                    {selectedStock.sector}
                  </span>
                )}
              </div>

              <span className="h-3 w-px bg-zinc-800 shrink-0" />

              {/* Timeframe Popover Selector */}
              <div className="relative shrink-0" ref={timeframeRef}>
                <button
                  type="button"
                  onClick={() => setIsTimeframeOpen((prev) => !prev)}
                  title="Fibonacci Analysis Timeframe"
                  aria-label="Fibonacci Analysis Timeframe"
                  aria-expanded={isTimeframeOpen}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 text-xs font-mono font-medium text-paper hover:bg-zinc-800 hover:border-zinc-600 transition-colors shadow-xs"
                >
                  <ClockIcon className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{selectedTimeframe}</span>
                  <ChevronDownIcon
                    className={`h-3 w-3 text-zinc-400 transition-transform duration-150 ${
                      isTimeframeOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isTimeframeOpen && (
                  <div
                    className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl z-40 backdrop-blur-xs"
                    role="menu"
                  >
                    <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-1 mb-1.5">
                      Intraday Timeframe
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {TIMEFRAME_OPTIONS.map((tf) => {
                        const isActive = selectedTimeframe === tf;
                        return (
                          <button
                            key={tf}
                            type="button"
                            onClick={() => {
                              setSelectedTimeframe(tf);
                              setIsTimeframeOpen(false);
                            }}
                            className={`h-7 rounded-md text-xs font-mono transition-colors text-center ${
                              isActive
                                ? "bg-paper text-ink font-bold shadow-xs"
                                : "bg-zinc-900 text-zinc-400 hover:text-paper hover:bg-zinc-800 border border-zinc-800"
                            }`}
                          >
                            {tf}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!selectedStock && (
            <span className="hidden sm:inline-block text-xs font-mono text-zinc-500">
              No symbol selected. Click Search Symbol to inspect.
            </span>
          )}
        </div>

        {/* Right: Refresh Button & Market Session */}
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {selectedStock && (
            <button
              type="button"
              onClick={() => fetchAnalysis(selectedStock, true)}
              disabled={isLoadingSymbol || isRefreshing}
              title="Refresh Quotes & Fibonacci Levels"
              aria-label="Refresh Quotes"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-paper hover:border-zinc-700 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshIcon
                className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-paper" : ""}`}
              />
            </button>
          )}

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                symbolAnalysis?.marketStatus.isOpen ? "bg-paper animate-pulse" : "bg-zinc-600"
              }`}
            />
            <span>{symbolAnalysis?.marketStatus.isOpen ? "NSE LIVE" : "MARKET CLOSED"}</span>
          </div>
        </div>
      </div>

      {/* 2. Main Workspace */}
      <div className="flex-1 w-full overflow-y-auto p-4 sm:p-6 bg-ink flex flex-col gap-5">
        {/* State A: No Symbol Selected */}
        {!selectedStock && (
          <div className="flex flex-col items-center justify-center flex-1 py-28 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 text-zinc-400 mb-4 shadow-sm">
              <ChartBarIcon className="h-6 w-6 text-zinc-400" />
            </div>
            <h2 className="text-sm font-sans font-bold text-paper mb-1">
              No Symbol Selected
            </h2>
            <p className="text-xs font-mono text-zinc-500 max-w-md mb-5 leading-relaxed">
              Search and select any NSE stock to inspect its Previous Day Range, AC/DC 38.2% Fibonacci levels, Open Interest, and live breakout status.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsSearchModalOpen(true);
                setModalSearchQuery("");
                setSearchResults([]);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-paper px-3.5 text-xs font-mono font-bold text-ink hover:bg-zinc-200 transition-all shadow-xs"
            >
              <SearchIcon className="h-3.5 w-3.5" />
              <span>Search Symbol</span>
            </button>
          </div>
        )}

        {/* State B: Loading Active Symbol */}
        {selectedStock && isLoadingSymbol && (
          <div className="flex flex-col items-center justify-center flex-1 py-28 gap-2 font-mono">
            <RefreshIcon className="h-5 w-5 animate-spin text-paper" />
            <span className="text-xs text-zinc-400">Loading {selectedStock.symbol} metrics...</span>
          </div>
        )}

        {/* State C: Active Symbol Loaded */}
        {selectedStock && !isLoadingSymbol && symbolAnalysis && (
          <div className="flex flex-col gap-5 max-w-6xl w-full mx-auto">
            {/* PANEL 1: Live Quotation & Execution Metrics */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 font-mono">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-paper uppercase tracking-wider">
                    {symbolAnalysis.symbol} Live Execution Metrics
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    ({symbolAnalysis.name})
                  </span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  Timeframe: <span className="text-paper font-semibold">{selectedTimeframe}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* LTP */}
                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink">
                  <div className="text-[10px] text-zinc-500 uppercase">LTP</div>
                  <div className="text-base font-bold text-paper mt-0.5">
                    {symbolAnalysis.quote.lastPrice.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Live Price</div>
                </div>

                {/* Day Net Change */}
                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink">
                  <div className="text-[10px] text-zinc-500 uppercase">Day Chg</div>
                  <div className="mt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${
                        symbolAnalysis.quote.netChange >= 0
                          ? "bg-zinc-800 text-paper border border-zinc-700"
                          : "bg-red-950/40 text-red-400 border border-red-900/50"
                      }`}
                    >
                      {symbolAnalysis.quote.netChange >= 0 ? "+" : ""}
                      {symbolAnalysis.quote.netChange.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Today vs Prev Close</div>
                </div>

                {/* Open Interest */}
                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink">
                  <div className="text-[10px] text-zinc-500 uppercase">Open Interest (OI)</div>
                  <div className="text-base font-bold text-paper mt-0.5">
                    {symbolAnalysis.quote.oi > 0 ? (
                      <span title={`${symbolAnalysis.quote.oi.toLocaleString("en-IN")} open contracts`}>
                        {symbolAnalysis.quote.oi >= 1000000
                          ? `${(symbolAnalysis.quote.oi / 1000000).toFixed(2)}M`
                          : symbolAnalysis.quote.oi >= 1000
                          ? `${(symbolAnalysis.quote.oi / 1000).toFixed(1)}k`
                          : symbolAnalysis.quote.oi.toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="text-zinc-600 text-xs" title="Non-F&O stock: Cash shares carry no derivative Open Interest">
                        N/A
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">
                    {symbolAnalysis.quote.oi > 0 ? "F&O Open Contracts" : "Cash Equity"}
                  </div>
                </div>

                {/* Session Volume */}
                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink">
                  <div className="text-[10px] text-zinc-500 uppercase">Volume</div>
                  <div className="text-base font-bold text-paper mt-0.5">
                    {symbolAnalysis.quote.volume >= 1000000
                      ? `${(symbolAnalysis.quote.volume / 1000000).toFixed(2)}M`
                      : symbolAnalysis.quote.volume >= 1000
                      ? `${(symbolAnalysis.quote.volume / 1000).toFixed(1)}k`
                      : symbolAnalysis.quote.volume.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Session Cumulative</div>
                </div>

                {/* Today's Intraday Range */}
                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-zinc-500 uppercase">Today&apos;s Range</div>
                  <div className="text-xs font-semibold text-zinc-200 mt-1">
                    {symbolAnalysis.quote.low.toFixed(2)} — {symbolAnalysis.quote.high.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Intraday Low — High</div>
                </div>
              </div>
            </div>

            {/* PANEL 2: Previous Day Reference Range (Fibonacci Baseline) */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 font-mono">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
                <span className="text-xs font-bold text-paper uppercase tracking-wider">
                  Previous Day Baseline (Fibonacci Anchor Range)
                </span>
                <InfoTooltip
                  text="Daily high and low price range from the previous trading session used as the mathematical baseline anchors for Fibonacci calculations."
                  side="bottom"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink">
                  <div className="text-[10px] text-zinc-500 uppercase">Previous Day High (PDH)</div>
                  <div className="text-base font-bold text-paper mt-1">
                    {symbolAnalysis.levels.pdh.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">100.0% Fib Baseline Anchor</div>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink">
                  <div className="text-[10px] text-zinc-500 uppercase">Previous Day Low (PDL)</div>
                  <div className="text-base font-bold text-paper mt-1">
                    {symbolAnalysis.levels.pdl.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">0.0% Fib Baseline Anchor</div>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink">
                  <div className="text-[10px] text-zinc-500 uppercase">Daily Range Span</div>
                  <div className="text-base font-bold text-paper mt-1">
                    {symbolAnalysis.levels.range.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">PDH - PDL Spread</div>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800/80 bg-ink">
                  <div className="text-[10px] text-zinc-500 uppercase">Previous Day Close (PDC)</div>
                  <div className="text-base font-bold text-paper mt-1">
                    {symbolAnalysis.levels.pdc.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">Previous Session Close</div>
                </div>
              </div>
            </div>

            {/* PANEL 3: Fibonacci 38.2% Structural Levels (AC 38.2% and DC 38.2% ONLY) */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 font-mono">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 mb-3">
                <span className="text-xs font-bold text-paper uppercase tracking-wider">
                  Fibonacci 38.2% Structural Levels
                </span>
                <InfoTooltip
                  text="Ascending (AC) and Descending (DC) 38.2% structural levels calculated from Previous Day High, Low, and Range."
                  side="bottom"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* AC 38.2% */}
                <div className="p-4 rounded-xl border border-zinc-700 bg-ink flex flex-col justify-between gap-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-paper">AC 38.2%</span>
                      <span className="text-[10px] text-zinc-500">(Ascending Retracement)</span>
                    </div>
                    <InfoTooltip
                      text="Ascending Fibonacci 38.2% level: PDH - 0.382 * (PDH - PDL). Key structural retracement pivot from high."
                      side="bottom"
                    />
                  </div>

                  <div>
                    <div className="text-2xl font-bold font-mono text-paper">
                      {symbolAnalysis.levels.ac38_2.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-1">
                      Formula: PDH ({symbolAnalysis.levels.pdh.toFixed(2)}) - 0.382 × Range ({symbolAnalysis.levels.range.toFixed(2)})
                    </div>
                  </div>

                  <div className="text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-2">
                    Primary resistance &amp; reversal trigger level
                  </div>
                </div>

                {/* DC 38.2% */}
                <div className="p-4 rounded-xl border border-zinc-700 bg-ink flex flex-col justify-between gap-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-paper">DC 38.2%</span>
                      <span className="text-[10px] text-zinc-500">(Descending Retracement)</span>
                    </div>
                    <InfoTooltip
                      text="Descending Fibonacci 38.2% level: PDL + 0.382 * (PDH - PDL). Key structural retracement pivot from low."
                      side="bottom"
                    />
                  </div>

                  <div>
                    <div className="text-2xl font-bold font-mono text-paper">
                      {symbolAnalysis.levels.dc38_2.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-1">
                      Formula: PDL ({symbolAnalysis.levels.pdl.toFixed(2)}) + 0.382 × Range ({symbolAnalysis.levels.range.toFixed(2)})
                    </div>
                  </div>

                  <div className="text-[10px] text-zinc-500 border-t border-zinc-800/80 pt-2">
                    Primary support &amp; breakout trigger level
                  </div>
                </div>
              </div>
            </div>

            {/* PANEL 4: Live Intraday Breakout Evaluation for Selected Timeframe */}
            {currentBreakout && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 font-mono">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-paper uppercase tracking-wider">
                      Intraday Breakout Status ({selectedTimeframe})
                    </span>
                    <InfoTooltip
                      text={`Evaluates whether today's price has broken above or below Fibonacci AC/DC 38.2%, PDH, or PDL on the ${selectedTimeframe} candle timeframe.`}
                      side="bottom"
                    />
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    Live Candle Inspection
                  </div>
                </div>

                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    currentBreakout.hasBroken
                      ? currentBreakout.direction === "BULLISH"
                        ? "border-zinc-700 bg-zinc-900 shadow-xs"
                        : "border-red-900/60 bg-red-950/30"
                      : "border-zinc-800 bg-ink"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        currentBreakout.hasBroken
                          ? currentBreakout.direction === "BULLISH"
                            ? "bg-paper text-ink"
                            : "bg-red-500 text-ink"
                          : "border border-zinc-800 bg-zinc-900 text-zinc-400"
                      }`}
                    >
                      {currentBreakout.hasBroken
                        ? currentBreakout.direction === "BULLISH"
                          ? "BULLISH BREAKOUT"
                          : "BEARISH BREAKOUT"
                        : "INSIDE FIB RANGE"}
                    </span>

                    <div>
                      <div className="text-xs font-bold text-paper">
                        {currentBreakout.statusLabel}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {currentBreakout.hasBroken
                          ? `Triggered at ${currentBreakout.breakoutTime || "intraday"} on ${selectedTimeframe} timeframe`
                          : `Price trading within the 38.2% Fibonacci corridor`}
                      </div>
                    </div>
                  </div>

                  {currentBreakout.hasBroken && (
                    <div className="flex items-center gap-6 text-xs border-t sm:border-t-0 sm:border-l border-zinc-800 pt-2 sm:pt-0 sm:pl-6">
                      {currentBreakout.levelPrice && (
                        <div>
                          <div className="text-[10px] text-zinc-500 uppercase">Level</div>
                          <div className="font-bold text-paper">
                            {currentBreakout.levelPrice.toFixed(2)}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-[10px] text-zinc-500 uppercase">Trigger Price</div>
                        <div className="font-bold text-paper">
                          {currentBreakout.triggerPrice.toFixed(2)}
                        </div>
                      </div>

                      {currentBreakout.breakoutTime && (
                        <div>
                          <div className="text-[10px] text-zinc-500 uppercase">Time</div>
                          <div className="font-bold text-paper">
                            {currentBreakout.breakoutTime}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Dedicated Fixed-Size Symbol Search Modal (Zero Jumping / Zero Resizing) */}
      {isSearchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md h-[460px] rounded-2xl border border-zinc-800 bg-zinc-950 flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 shrink-0 bg-zinc-950">
              <div className="flex items-center gap-2">
                <SearchIcon className="h-4 w-4 text-paper" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-paper font-sans">
                  Search NSE Symbol
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchModalOpen(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:text-paper hover:bg-zinc-800 transition-colors"
                title="Close"
                aria-label="Close search"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Modal Search Input */}
            <div className="p-3 border-b border-zinc-800 bg-ink shrink-0">
              <div className="relative flex items-center">
                <SearchIcon className="absolute left-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  value={modalSearchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setModalSearchQuery(val);
                    if (!val.trim()) {
                      setSearchResults([]);
                    }
                  }}
                  placeholder="Type symbol or name (e.g. RELIANCE, TCS)..."
                  autoFocus
                  className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-8 text-xs font-mono text-paper placeholder-zinc-500 focus:outline-none focus:border-paper"
                />
                {modalSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="absolute right-2.5 text-zinc-500 hover:text-paper"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Results List (Fixed Height Body) */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/80 bg-ink">
              {isSearchingDb ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-xs font-mono text-zinc-500 py-12">
                  <RefreshIcon className="h-4 w-4 animate-spin text-zinc-400" />
                  <span>Searching database...</span>
                </div>
              ) : modalSearchQuery.trim() === "" ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-xs font-mono text-zinc-500">
                  <span>Type a symbol or company name to search across 2,680+ NSE equities.</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-xs font-mono text-zinc-500">
                  <span>No matching equities found for &quot;{modalSearchQuery}&quot;.</span>
                </div>
              ) : (
                searchResults.map((stk) => (
                  <button
                    key={stk.instrument_key}
                    type="button"
                    onClick={() => handleSelectStock(stk)}
                    className="w-full px-4 py-2.5 text-left hover:bg-zinc-900/80 transition-colors flex items-center justify-between font-mono group"
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="text-xs font-bold text-paper group-hover:text-paper">
                        {stk.symbol}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {stk.name}
                      </div>
                    </div>
                    {stk.sector && (
                      <span className="text-[9px] text-zinc-500 border border-zinc-800 bg-zinc-950 px-2 py-0.5 rounded shrink-0">
                        {stk.sector}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-800 bg-zinc-950 px-4 py-2 text-[10px] font-mono text-zinc-500 flex items-center justify-between shrink-0">
              <span>{searchResults.length} {searchResults.length === 1 ? "match" : "matches"}</span>
              <span>ESC to cancel</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
