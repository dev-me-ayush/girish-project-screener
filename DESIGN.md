# Tessera Design System & Visual Authority

## Philosophy
Minimalist, high-density, institutional terminal aesthetic. Zero decorative AI slop, zero fake mockups, zero green colors. High contrast monochrome typography with razor-sharp hairline dividers and functional hierarchy.

## Color Tokens
- **Canvas / Background**: `#09090b` (`--color-ink`) — deep true dark.
- **Raised Panels**: `#131315` / `#18181b` (`--color-ink-raised`, `--color-panel`) — subtle elevation for terminal cards and toolbars.
- **Borders & Dividers**: `#27272a` (`--color-line`) hairline borders (1px solid).
- **Foreground / Text Primary**: `#ffffff` (`--color-paper`) — high contrast pure white.
- **Muted Text**: `#a1a1aa` (`--color-muted`) — secondary metadata, labels (passes 4.5:1 contrast).
- **Faint Text**: `#71717a` (`--color-faint`) — tertiary timestamps, exchange codes.
- **Accents**: Pure white `#ffffff` (`--color-signal`) for active switches and highlights; `#f87171` (`--color-drop`) for negative percentage/bearish drops. No green colors.

## Typography
- **Primary Sans**: `Geist Sans`, `Inter`, system sans.
- **Data & Numbers**: `JetBrains Mono`, tabular figures (`font-variant-numeric: tabular-nums`).
- **Headings**: Direct, balanced, no decorative kickers or faux-editorial flourishes.

## Component Patterns
- **Header Switcher**: Top-level segmented control hosting the four primary workspaces:
  1. `Overview` (`/dashboard/overview`)
  2. `Watchlist` (`/dashboard/watchlists`)
  3. `Watchlist Screener` (`/dashboard/scanner`)
  4. `Fibonacci Levels` (`/dashboard/fibonacci`)
- **Zero Left-Side Panel**: The entire viewport width is dedicated to the terminal workspace.
- **Terminal Cards**: Crisp 1px border (`border-line`), rounded-xl (`12px`), dark background, dense tabular presentation.
