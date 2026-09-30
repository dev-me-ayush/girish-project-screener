# Dashboard Overview Architecture & Features

## 1. Redesigned Overview Terminal

The `/dashboard/overview` surface is an institutional-grade, zero-padding financial terminal designed with the **Impeccable** design standard.

### Core Features
- **Flush Edge-to-Edge Canvas**: Zero unnecessary whitespace or container padding. Continuous hairline borders (`#27272a`) span across the full viewport width.
- **Top Header Navigation Switch**: Segmented institutional tabs (Overview, Watchlist, Watchlist Screener, Fibonacci Levels) with zero sidebars.
- **Benchmark Indices Matrix**:
  - Displays **NIFTY 50** (`NSE_INDEX|Nifty 50`), **BANK NIFTY** (`NSE_INDEX|Nifty Bank`), and **SENSEX** (`BSE_INDEX|SENSEX`).
  - **Single-Line Row Structure**: Continuous edge-to-edge row layout replacing card boxes.
  - **Zero Rupee Symbols**: Prices rendered strictly as formatted numbers without `₹` anywhere.
  - **No OHLC Matrix**: Removed cluttered Open/High/Low/Close blocks.
  - **Fibonacci Range**: Directly displays AC 38.2, DC 38.2, and Reference Session Date alongside LTP and Change.
- **Dual Cadence Synchronization**:
  - **Minute-Boundary Auto-Refresh**: Synchronized directly with the `:00` second clock rollover when the 1-minute candle closes, recurring every 60 seconds.
  - **Instant Manual Refresh**: Interactive trigger with spinning state that updates the data and exact timestamp immediately.
  - **Countdown Telemetry**: Displays the exact seconds remaining until the next minute close.

---

## 2. Watchlist Terminal (`/dashboard/watchlists`)

An institutional, zero-padding watchlist management terminal with live Upstox execution quotes, headless background scanner toggle, and watchlist-level timeframe configuration.

### Core Features
- **Directory Mode (Horizontal Panel Structure)**:
  - Spans full width from left to right directly beneath the header.
  - Left side: Displays strictly the Watchlist Name and the Stock Count with Timeframe (`X Stocks • 15m`). All unwanted badges (`SCANNER ACTIVE/IDLE`), creation dates, and last scan timestamps are removed.
  - Right side:
    - Dedicated icon-only Start/Stop Scanner toggle button: Emerald Green with Play icon when idle; Crimson Red with Stop icon when active. Zero text.
    - Dedicated icon-only Settings button with Gear icon.
  - Top header button streamlined to `+ Create`.
- **Institutional Empty State**:
  - When 0 watchlists exist, renders a centered, high-contrast action card with `BookmarkIcon` badge and direct `+ Create` workflow.
  - Eliminates duplicate header CTA buttons and centers focus on list creation.
  - Full-viewport height container (`min-h-[calc(100dvh-3.5rem)]`) with pinned bottom footer.
- **Transient Draft Creation**:
  - Clicking `+ Create` reveals an inline name input with `Save` and `Cancel` triggers.
  - Zero database pollution: if the user does not save and refreshes the page, the draft is immediately discarded.
  - When saved, the watchlist is committed blank (`0 stocks`) to Neon PostgreSQL with designated timeframe and transitions into a saved panel.
- **Watchlist Settings & Excel-Style Worksheet**:
  - Accessed by clicking the `[⚙]` Settings icon button on any watchlist panel.
  - **Top Control Bar**:
    - Compact icon-only back button (`ArrowLeftIcon`) returning to the directory view without bulky text.
    - Watchlist title with an institutional pen icon (`PencilIcon`) trigger for inline editing, saved via checkmark button or Enter key.
    - **Watchlist-Level Timeframe Selector**: Institutional popover dropdown button with `ClockIcon` and `ChevronDownIcon` displaying the active timeframe (`1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `1D`, `1W`). Organized by Minutes, Hours, and Days. Eliminates per-stock dropdown clutters and unifies the timeframe for the entire watchlist.
    - Search Symbols trigger positioned cleanly on the left side beside the timeframe.
    - Delete Watchlist button situated cleanly on the right side next to refresh.
  - **Optimistic Symbol Addition & 0ms Modal Dismissal**:
    - Clicking any equity, index, or option in the search pop-up immediately dismisses the modal (0ms perceived latency) and optimistically adds the row to the table.
    - Added instruments inherit the watchlist's designated timeframe automatically.
    - Live Upstox quote hydration resolves concurrently via multi-key token and symbol alias mapping (`instrument_token`, `symbol`, `NSE_EQ:SYMBOL`).
    - Works during live market and during market-closed hours (falling back to closing price and net change).
  - **Streamlined Symbols Table**:
    - Clean columns: `#`, `Type`, `Symbol / Contract`, `LTP (₹)`, `Day Chg`, and `Action`.
    - Removed per-row timeframe select to deliver a clean spreadsheet layout.
    - Real-time LTP and Day Change hydration populated instantly upon addition with off-hours close fallback.
  - **Fixed-Height Symbol Search Pop-up Panel**:
    - Fixed container height (`h-[560px]`) prevents layout resizing or jumping when search results filter.
    - Fast searching across **2,680+ listed NSE stocks**, Benchmark Indices, and Index Options (ATM ±7 strikes).
  - **Headless Background Scanner**: Integrated Start/Stop scanning switch. When activated, scanning state persists in Neon (`is_scanning_active = true`), executing autonomous background scans across symbols even if the user leaves the website.
- **Strict Monochrome & Impeccable Standards**:
  - Completely dark palette (`#09090b`), crisp hairline borders (`#27272a`).
  - Zero green colors: positive deltas use crisp white text on zinc chips (`bg-zinc-800 text-paper border border-zinc-700`); negative deltas use soft crimson (`text-red-400 bg-red-950/40 border-red-900/50`).

---

## 3. Watchlist Screener Terminal (`/dashboard/scanner`)

An institutional, continuous edge-to-edge multi-watchlist screener tracking Previous Day High/Low breaches and key Fibonacci retracement levels (AC 38.2% and DC 38.2%).

### Core Features
- **Continuous Edge-to-Edge Header Bar**:
  - Pinned directly below the main app navigation header (`h-12 border-b border-zinc-800 bg-ink px-4 sm:px-6`).
  - Houses the screener title, informational tooltip, and interactive Watchlist Filter Popover.
  - Allows traders to filter by individual watchlists or scan all active watchlists concurrently.
- **Removed Redundant Watchlist Column**:
  - Since the user selects the watchlist from the header dropdown, the per-row `Watchlist` column was eliminated to save horizontal space and improve data density.
- **AC 38.2% & DC 38.2% Fibonacci Levels**:
  - Stripped non-essential 50% and 61.8% levels.
  - Exclusively displays Previous Day High (`PDH`), Low (`PDL`), Ascending 38.2% (`AC 38.2%`), and Descending 38.2% (`DC 38.2%`).
- **Open Interest (OI) Integration**:
  - Multi-key alias mapping pulls live Open Interest for F&O derivative contracts from Upstox.
  - Displays formatted contract OI (e.g. `1.85M`, `245.5k`, `18,500`) for derivatives, and `0` for cash equities with clear explanatory tooltips.
- **Portal-Rendered Info Tooltips**:
  - Built with React `createPortal` mounting directly to `document.body` with `position: fixed` and `zIndex: 99999`.
  - Permanently eliminates clipping and divider overlapping caused by table borders, sticky headers, and `overflow-x-auto` scroll containers.
  - Every column header (`#`, `Symbol`, `TF`, `LTP`, `Day Chg`, `OI`, `Volume`, `PDH`, `PDL`, `AC 38.2%`, `DC 38.2%`, `Breakout Status`, `Time`) is equipped with an educational info tooltip.
- **Zero Currency Symbols**:
  - Prices (LTP, PDH, PDL, AC 38.2%, DC 38.2%) rendered strictly as clean formatted numbers with zero `₹` symbols anywhere.
- **Spreadsheet Table Layout**:
  - Sticky `#` and `Symbol` columns for seamless horizontal panning.
  - High-contrast breakout state chips (`▲ BULLISH BREAKOUT` / `▼ BEARISH BREAKDOWN` / `Inside Range`).
  - Telemetry footer pinned to viewport bottom showing active watchlist count and total screened instruments.
