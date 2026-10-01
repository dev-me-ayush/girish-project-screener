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
- **Strict Indian Standard Time (IST / Asia/Kolkata)**:
  - All candle timestamps, breakout trigger times (`breakoutTime`), scan telemetry timestamps (`lastScannedAt`), and ticker sync times explicitly specify `{ timeZone: "Asia/Kolkata" }`.
  - Permanently eliminates UTC skew (e.g. 10:30 AM IST displaying as 05:00 AM on cloud container runtimes).
  - Handles gap-up and gap-down openings, accurately capturing the initial market open breakout time (`09:15 am`).
- **Spreadsheet Table Layout**:
  - Sticky `#` and `Symbol` columns for seamless horizontal panning.
  - Clean monochrome breakout status indicators (`Up Breakout`, `Low Breakout`, `Inside Range`) rendered strictly in normal white color without decorative badge clutters.
  - Instant real-time symbol search filter in the toolbar for searching strikes, CE/PE, or tickers.
  - Telemetry footer pinned to viewport bottom showing active watchlist count and total screened instruments.

---

## 4. Auto-Syncing Default Options Watchlist (ATM ±7)

A fully automated, zero-maintenance default options watchlist designed specifically for high-liquidity index options trading.

### Core Architecture
- **Curated High-Liquidity Universe (~52 Contracts)**:
  - **NIFTY 50** (`NSE_INDEX|Nifty 50`): Nearest active weekly expiry with ATM ± 7 strikes (15 strikes: 15 CE + 15 PE = 30 contracts).
  - **BANK NIFTY** (`NSE_INDEX|Nifty Bank`): Nearest active weekly expiry with ATM ± 5 strikes (11 strikes: 11 CE + 11 PE = 22 contracts).
  - Concentrates strictly where 95%+ of Indian market derivatives volume and liquidity reside.
- **Dynamic Daily Synchronization**:
  - Automatically identifies current spot price and current ATM strike.
  - Detects the nearest valid weekly expiry ($\ge$ today in IST).
  - Auto-syncs into Neon PostgreSQL under `DEFAULT OPTIONS (ATM ±7)`.
  - Automatically clears old or expired strikes on weekly rollover—the user never needs to manually add strikes or delete expired contracts.
  - Integrated into `GET /api/watchlists`, scanner execution, and daily maintenance cron (`/api/cron/maintenance`).
- **Strict 38.2% Fibonacci Breakout Logic**:
  - Evaluates option premium Previous Day High (`PDH`), Low (`PDL`), and Close (`PDC`).
  - Calculates `AC 38.2%` ($\text{PDC} + \text{Range} \times 0.382 \times 1.236$) and `DC 38.2%` ($\text{PDC} - \text{Range} \times 0.382 \times 1.236$).
  - Displays strictly:
    - **`Up Breakout`**: Option premium trades above AC 38.2%.
    - **`Low Breakout`**: Option premium decays below DC 38.2%.
    - **`Inside Range`**: Option premium trades within the 38.2% corridor.
  - Rendered in clean normal white color (`text-paper` / `#ffffff`) in monospace typography without extra badges or colored highlights.
- **Instant Symbol Search**:
  - Real-time client-side filter input in the scanner toolbar allowing traders to filter contracts by strike price (`22750`, `54700`), contract type (`CE`, `PE`), or underlying (`NIFTY`, `BANKNIFTY`).

---

## 5. Fibonacci Levels Terminal (`/dashboard/fibonacci`)

A fast, focused terminal for inspecting exact Previous Day High/Low ranges, AC/DC 38.2% Fibonacci structural pivots, and intraday breakout status for any NSE stock or option contract.

### Core Features
- **Unified Fast Search (Equities + Options)**:
  - Backed by `/api/instruments/equities` with PostgreSQL query merging `stocks` (2,680+ listed equities) and active `watchlist_items` (index option contracts).
  - Instant pre-population: When the search modal opens with an empty query, top benchmark equities (`20MICRONS`, `RELIANCE`, `TCS`, `HDFCBANK`) and active ATM option strikes are instantly displayed without waiting for typing.
  - Returns both `stocks` and `equities` payload keys to maintain total backward and forward compatibility.
- **Auto-Loading Default Symbol (`20MICRONS`)**:
  - Upon visiting `/dashboard/fibonacci`, the terminal immediately hydrates `20MICRONS` with live Upstox daily candles and intraday execution data, ensuring the page is ready with live Fibonacci calculations instead of an empty initial state.
- **Strict Essential Data Focus (Zero Bloat)**:
  - **Panel 1: Execution Metrics**: LTP, Day Change, Open Interest (OI), Session Volume, and Today's High/Low Range.
  - **Panel 2: Previous Day Reference Range**: Previous Day High (PDH), Previous Day Low (PDL), Daily Range Span, and Previous Day Close (PDC).
  - **Panel 3: Fibonacci 38.2% Levels**: AC 38.2% ($\text{PDC} + \text{Range} \times 0.382 \times 1.236$) and DC 38.2% ($\text{PDC} - \text{Range} \times 0.382 \times 1.236$).
  - **Panel 4: Live Intraday Breakout**: Evaluates whether today's price has broken above AC 38.2% (`Up Breakout`), dropped below DC 38.2% (`Low Breakout`), or remained within (`Inside Range`). Rendered in normal white text (`#ffffff`) without unwanted extra text or decorative clutter.

---

## 6. Institutional 1-Minute Screener (`/dashboard/scanner`)

A high-performance market screener monitoring 2,732 instruments (2,680 equities + 52 ATM index option contracts) on an ultra-responsive 1-minute cadence.

### Core Features
- **Dynamic Header Market Indicator (`HeaderMarketStatus`)**:
  - Moved completely into the global top navigation bar to eliminate wasted vertical page padding.
  - Powered by `useSyncExternalStore` and `getMarketSessionStatus()` with zero cascading renders.
  - Real-time updates: `NSE LIVE (09:15–15:30)` with pulsing indicator dot during market hours; `NSE CLOSED (OPENS 09:15)` / `WEEKEND` / `HOLIDAY` during off-market hours.
- **Single-Line Consolidated Control Cluster (`ScannerToolbar`)**:
  - Consolidates the **Search input**, **Segmented Filter Tabs**, **IST Clock (`IST HH:MM`)**, **Last Synced Timestamp (`Synced HH:MM`)**, and **Interactive 1m Refresh Button (`[↻ Refresh]`)** into a unified, single horizontal bar.
  - Eliminates 3–4 stacked tiers of controls down to one row, drastically increasing visible table rows above the fold.
- **High-Velocity 1-Minute Scan Pipeline**:
  - Automatically polls every 60 seconds with server-side in-memory caching (TTL 50s) to absorb concurrent user loads.
  - Consumes only 6 Upstox HTTP quote requests per minute (500 symbols/request), utilizing only 1.2% of Upstox rate limits.
  - In-memory cached equities catalog and preloaded daily levels eliminate per-minute database query overhead.
- **Clean Tabular Screener (Zero Banner Intrusions)**:
  - Breakout banners and intrusive alerts removed entirely from the screener surface to preserve institutional focus and table density.
  - Breakout alerts reside exclusively in the dedicated **Alerts Feed** (`/dashboard/alerts`).
- **Watchlist-Scoped Alerts Feed (`/dashboard/alerts`)**:
  - The alert feed strictly filters events to symbols present in the user's watchlist (`watchlist_items`) or pinned items (`user_pinned_symbols`).
  - Eliminates noise from 2,700+ non-watchlist instruments and delivers focused breakout telemetry for portfolio holdings.
- **Production-Grade Excel Export (`Download as Excel`)**:
  - Integrated directly adjacent to the segmented tabs switch on the screener toolbar, pinned watchlist view, and alerts feed.
  - Dynamically exports currently active view: `[All (2,732)]`, `[Equities (2,680)]`, `[Options (52)]`, `[Up Breakouts]`, `[Low Breakouts]`, `[★ Watchlist]`, or custom searches.
  - Generates RFC 4180 CSV with UTF-8 Byte Order Mark (`\uFEFF`) and CRLF line breaks, opening seamlessly in Microsoft Excel, macOS Numbers, and Google Sheets without encoding warnings.
  - Core columns exported: `Symbol Name`, `Type`, `1-Minute LTP`, `Day Change`, `PDH`, `PDL`, `PDC`, `AC 38.2%`, `DC 38.2%`, `Status`, `Breach Count`, and `Trigger Time`.
- **Client-Anchored Fibonacci Breakout Engine**:
  - Evaluates live LTP against AC 38.2% and DC 38.2% levels using the client ground truth formula.
  - Strict `ltp > 0` validation to permanently eliminate illiquid zero-price instruments from false breakdown triggers.
  - Distinct Multiple Trigger Tracking: Instead of collapsing multiple crossings into a generic "2x" tag, each breach is logged and displayed as an individual, distinct trigger event (`Trigger #1`, `Trigger #2`, etc.) with its exact trigger price and high-precision IST timestamp (`HH:mm:ss`).
  - Buffered asynchronous batch inserts into Neon Postgres (`scanner_alerts`) preventing connection pool saturation.

