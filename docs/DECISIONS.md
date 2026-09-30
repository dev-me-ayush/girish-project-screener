# Architectural & Design Decisions

## 2026-09-29: Dashboard Overview Terminal Redesign

### Context
The previous overview layout suffered from excessive outer container padding (`p-6 sm:p-8`), cluttered navigation elements, non-essential summary boxes ("Watchlists Created"), and lacked synchronized market cadence.

### Decisions
1. **Sidebar Minimization**:
   - Left-side panel strictly houses primary trading surfaces per navigation standards.
   - Clean user identity block at bottom with minimal "Exit" trigger.
2. **Container Padding Removal**:
   - `DashboardShell`'s `<main>` container was converted to `flex-1 flex flex-col min-w-0 h-dvh overflow-y-auto bg-ink`, delegating internal padding completely to flush layouts.
3. **Minute Close Synchronization**:
   - Replaced fixed interval polling with clock-boundary alignment: calculates milliseconds until `:00` seconds of the clock minute, fires the fetch precisely on close, and continues in 60-second increments.
4. **Zero AI Slop / Impeccable Standards**:
   - Strict monochrome palette (`#09090b` background, `#27272a` hairline borders, `#ffffff` high contrast text).
   - Forbidden green rule enforced: positive returns use crisp high-contrast white on zinc chips, negative returns use muted crimson/red chips.

---

## 2026-09-29: Watchlist Terminal Implementation

### Context
Traders require active symbol universe curation directly following benchmark overview inspection.

### Decisions
1. **Inline Symbol Discovery**:
   - Eliminated heavy multi-step modal dialogs in favor of an inline quick-add strip with segmented toggle between NSE Equities and Index Options (ATM ±7).
2. **Batch Market Quote Hydration**:
   - Enhanced `GET /api/watchlists/[id]` to batch-resolve live market quotes and Open Interest (`getQuotesAndOI`) directly on fetch, avoiding N+1 client round-trips.
3. **Minute-Cadence Real-Time Streaming**:
   - Replicated `:00` minute boundary auto-refresh on the watchlist quotation matrix so intraday candle closes and prices stay synchronized.

---

## 2026-09-29: Institutional Top-Header Navigation & Watchlist UX Overhaul

### Context
User requested removal of all left-side navigation panels in favor of a top header segmented switch across Overview, Watchlist, Watchlist Screener, and Fibonacci Levels. Overview required single-line continuous edge-to-edge dividers without OHLC matrix, zero currency symbols, and explicit AC/DC 38.2 Fibonacci columns. Watchlists required sub-second load times, fixed-height search modal, left-aligned search triggers, and instant quote resolution.

### Decisions
1. **Zero-Sidebar Header Navigation**:
   - Replaced sidebar layout in `DashboardShell` with a sticky top institutional header containing the 4 primary tabs: Overview (`/dashboard/overview`), Watchlist (`/dashboard/watchlists`), Watchlist Screener (`/dashboard/scanner`), and Fibonacci Levels (`/dashboard/fibonacci`).
2. **Edge-to-Edge Overview Grid**:
   - Removed card boxes and table paddings in `overview-terminal.tsx`; borders (`border-b border-line`) extend continuously across the full viewport width.
   - Stripped OHLC matrix; shows exclusively Index Name, Price (LTP), Price Change, AC 38.2, DC 38.2, and Reference Session Date without any `₹` currency symbols.
3. **Watchlist Performance & Quote Caching**:
   - Implemented in-memory quote caching (10s TTL) and `AbortSignal.timeout(3000)` in `lib/upstox.ts` to eliminate slow watchlist loading.
   - Normalized instrument key format parsing (`:` vs `|`) and added `ohlc.close` fallback for off-market hours.
4. **Fixed-Height Symbol Search Modal**:
   - Set modal container to fixed `h-[560px]` with internal scrollable body to permanently eliminate UI jittering and layout resizing during suggestion filtering.
   - Relocated "Search Symbols" button to the left side of the action bar next to the watchlist title, and removed redundant buttons from table cells.

---

## 2026-09-29: Watchlist-Level Timeframe Architectural Shift & UI Redesign

### Context
Traders manage strategies grouped by timeframes (e.g. "15m Momentum", "1D Swing"). Individual per-stock HTML select dropdowns on table rows added excessive visual noise, cognitive overhead, and broken aesthetics. Users requested expanded timeframe options (including hours and days) managed strictly at the watchlist level.

### Decisions
1. **Database Schema Shift**:
   - Added `timeframe VARCHAR(10) DEFAULT '1m' NOT NULL` to the `watchlists` table in Neon Serverless Postgres.
   - Updated watchlist endpoints (`/api/watchlists` and `/api/watchlists/[id]`) to persist and retrieve watchlist-level timeframes.
2. **Table Streamlining**:
   - Removed the per-row `Timeframe` select column from the spreadsheet table completely.
   - Reduced table columns to `#`, `Type`, `Symbol / Contract`, `LTP (₹)`, `Day Chg`, and `Action`.
3. **Institutional Timeframe Popover**:
   - Designed a custom popover selector placed in the top control bar beside the watchlist title.
   - Segmented into **Minutes** (`1m`, `3m`, `5m`, `15m`, `30m`), **Hours** (`1h`, `2h`, `4h`), and **Days** (`1D`, `1W`).
   - High-contrast monochrome active state (`bg-paper text-ink font-bold`) and outside-click dismissal.
4. **Directory Level Visibility**:
   - Displayed the active timeframe directly alongside stock count in the directory panels (`{wl.item_count} Stocks • {wl.timeframe || "1m"}`).
5. **Modal Inherited Context**:
   - Removed the redundant timeframe dropdown from the Symbol Search modal; newly added symbols inherit the watchlist's designated timeframe automatically.

---

## 2026-09-29: Watchlist Screener Sub-Header & Portal-Based Tooltip Architecture

### Context
On `/dashboard/scanner`, the watchlist selection was nested inside padded boxes rather than a unified continuous sub-header. Additionally, information tooltips were rendered inside table cells and were being clipped by table overflow boundaries, dividers, and sticky headers.

### Decisions
1. **Full-Width Edge-to-Edge Sub-Header**:
   - Pinned a dedicated `h-12` sub-header directly below the main header containing the screener title, informational tooltip, multi-watchlist filter selector, and on-demand scan triggers.
2. **React Portal Tooltip Architecture (`createPortal`)**:
   - Refactored `InfoTooltip` to mount directly to `document.body` with `position: fixed`, auto-clamping coordinates, and `zIndex: 99999`.
   - Tooltips now float above all table borders, dividers, sticky columns, and scroll containers without clipping.
3. **Comprehensive Metric Education & Column Optimization**:
   - Removed redundant `Watchlist` column from each row since the selected watchlist is chosen at the sub-header level.
   - Replaced 50% and 61.8% Fibonacci levels with `AC 38.2%` and `DC 38.2%` to match the exact institutional strategy.
   - Added educational info icons to all 13 table column headers and toolbar controls.
4. **Open Interest (OI) & Upstox Market Mechanics**:
   - Added multi-key token/symbol alias matching in `lib/scanner.ts` to ensure F&O derivatives resolve live Open Interest without key-mismatch failures.
   - Clarified that in Indian markets (NSE/BSE), cash equities do not carry Open Interest (reporting `0`), while derivative contracts report live contract open interest.
5. **Currency Formatting**:
   - Enforced zero rupee symbols (`₹`) across all table price values (LTP, PDH, PDL, AC 38.2%, DC 38.2%).
