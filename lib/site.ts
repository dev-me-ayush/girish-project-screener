export const site = {
  name: "Tessera",
  tagline: "The stock screener built for the Indian market.",
  nav: [
    { label: "Screener", href: "#screener" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ],
  signIn: { label: "Sign in", href: "/sign-in" },
  market: {
    status: "Market closed",
    stamp: "Fri, 3:30 PM IST",
    tape: [
      { label: "NIFTY 50", value: "25,142.60", change: "+0.64%", up: true },
      { label: "SENSEX", value: "82,015.45", change: "+0.58%", up: true },
      { label: "NIFTY BANK", value: "54,318.20", change: "+0.79%", up: true },
      { label: "NIFTY IT", value: "39,884.10", change: "-0.22%", up: false },
      { label: "NIFTY NEXT 50", value: "27,442.85", change: "+1.04%", up: true },
      { label: "NIFTY MIDCAP 150", value: "12,318.70", change: "+0.91%", up: true },
      { label: "NIFTY SMALLCAP 250", value: "16,905.30", change: "+1.12%", up: true },
      { label: "INDIA VIX", value: "12.44", change: "-3.10%", up: false },
    ],
  },
  hero: {
    eyebrow: "Live · 2,847 NSE + BSE symbols indexed",
    headline: ["Pehchaan the setup,", "before the market does."],
    lede: "Tessera screens every listed equity on the NSE and BSE in under 250 milliseconds. Price action, F&O open interest, promoter holding and results calendar — all in one query, in rupees, in IST.",
    primary: { label: "Sign in", href: "/sign-in" },
    secondary: { label: "See a real query", href: "#screener" },
    proof: [
      { value: "2,847", label: "NSE + BSE symbols" },
      { value: "240ms", label: "median full scan" },
      { value: "1.4M", label: "scans run daily" },
    ],
  },
  screener: {
    label: "Working screener",
    query:
      "close > sma(50) and rsi(14) < 45 and avg_vol(20) > 2.5e6 and mc_cap > 1000 and sector in ('NIFTY IT', 'NIFTY AUTO')",
    note: "Back-adjusted for splits, bonuses and dividends. Re-runs every 15 seconds during market hours.",
    rows: [
      {
        symbol: "TATAMOTORS",
        name: "Tata Motors Ltd",
        price: "682.40",
        change: "+3.84%",
        rsi: "38.6",
        volume: "8.42L",
        cap: "₹96,120 Cr",
        up: true,
      },
      {
        symbol: "ASIANPAINT",
        name: "Asian Paints Ltd",
        price: "2,438.15",
        change: "+2.17%",
        rsi: "41.2",
        volume: "3.16L",
        cap: "₹89,340 Cr",
        up: true,
      },
      {
        symbol: "TECHM",
        name: "Tech Mahindra Ltd",
        price: "1,482.30",
        change: "+1.64%",
        rsi: "36.9",
        volume: "4.28L",
        cap: "₹1,64,880 Cr",
        up: true,
      },
      {
        symbol: "HINDUNILVR",
        name: "Hindustan Unilever Ltd",
        price: "2,289.75",
        change: "+0.98%",
        rsi: "44.7",
        volume: "2.91L",
        cap: "₹2,71,400 Cr",
        up: true,
      },
      {
        symbol: "COALINDIA",
        name: "Coal India Ltd",
        price: "382.60",
        change: "-0.86%",
        rsi: "28.4",
        volume: "11.30L",
        cap: "₹1,13,900 Cr",
        up: false,
      },
    ],
  },
  features: {
    eyebrow: "The engine",
    title: "Jo Indian market ki khoj chahiye, wahi tool.",
    body: "Most screeners stop at price and volume. In India that is not enough — a stock is also an F&O contract, a promoter holding, a corporate action and a results date. Tessera puts all of it behind one query.",
    items: [
      {
        title: "A real query language",
        body: "Write conditions the way you say them. Nested groups, arithmetic, 310+ built-in functions, and any column from the fundamentals table.",
        icon: "terminal",
      },
      {
        title: "F&O data, not just spot",
        body: "Lot sizes, open interest build-up, implied volatility, max pain and the full expiry calendar. Screen a stock and its derivatives in the same query.",
        icon: "bolt",
      },
      {
        title: "Corporate actions, back-adjusted",
        body: "Splits, bonuses, rights issues, dividends and demergers are applied across the full history, so a ten-year backtest is actually a ten-year backtest.",
        icon: "layers",
      },
      {
        title: "Promoter, FII and DII flow",
        body: "Shareholding pattern, pledged shares, bulk and block deals, and daily FII/DII activity — filterable like any other column.",
        icon: "wave",
      },
      {
        title: "Results and events calendar",
        body: "Results, AGM, ex-date, dividend and board meeting dates in the same table, so you never scan into a known event by accident.",
        icon: "bookmark",
      },
      {
        title: "Alerts before the 9:15 open",
        body: "WhatsApp, email, Slack or webhook. Schedule a pre-open run at 9:00 AM and read your list with your chai, before the bell.",
        icon: "bell",
      },
    ],
  },
  steps: {
    eyebrow: "How it works",
    title: "Teen steps, aur phir daily ho jaata hai.",
    items: [
      {
        step: "01",
        title: "Setup likhiye",
        body: "Simple conditions mein likhiye, ya koi template se shuru kijiye. Purana preset bhi import ho jaata hai.",
      },
      {
        step: "02",
        title: "History par test kijiye",
        body: "Das saal ke adjusted bars par backtest kijiye, index se compare kijiye, aur dekhiye aapka edge kitni baar aata hai.",
      },
      {
        step: "03",
        title: "Schedule par bhej dijiye",
        body: "Live chalaiye, alert banaiye, ya broker ko result bhejiye. Research ek baar ka kaam nahi, roz ka hona chahiye.",
      },
    ],
  },
  stats: [
    { value: "240ms", label: "median full-universe scan" },
    { value: "10y", label: "of adjusted daily bars" },
    { value: "310+", label: "built-in functions" },
    { value: "0", label: "UPI, no card needed to start" },
  ],
  pricing: {
    eyebrow: "Pricing",
    title: "Free se shuru kijiye. Jab screener paisa banane lage, tab upgrade.",
    body: "Har plan mein poora query language aur unlimited saved screens. Aap sirf history ki gehraai aur alerts ki sankhya ke liye pay karte hain.",
    tiers: [
      {
        name: "Paper",
        price: "₹0",
        cadence: "forever",
        blurb: "Decide kijiye ki yeh tool aapke liye hai ya nahi.",
        features: [
          "200 symbols per scan",
          "1 saal ke adjusted daily bars",
          "10 saved screens",
          "5 alerts per day",
          "WhatsApp community support",
        ],
        cta: "Sign in",
        href: "/sign-in",
        highlighted: false,
      },
      {
        name: "Terminal",
        price: "₹499",
        cadence: "per month",
        blurb: "Roz scan karne wale traders ke liye.",
        features: [
          "All 2,847 NSE + BSE symbols",
          "10 saal daily + 1 saal intraday",
          "Unlimited saved screens",
          "500 alerts per day",
          "F&O open interest & IV",
          "Backtesting against any index",
        ],
        cta: "Start 14-day trial",
        href: "/sign-in",
        highlighted: true,
      },
      {
        name: "Desk",
        price: "Custom",
        cadence: "per seat",
        blurb: "Teams ke liye — ek hi source of truth, poora audit trail.",
        features: [
          "Everything in Terminal",
          "Shared screen library",
          "Role-based access and SSO",
          "Full query audit log",
          "Bulk and block deal feed",
          "Invoiced annually",
        ],
        cta: "Talk to us",
        href: "mailto:sales@tessera.example",
        highlighted: false,
      },
    ],
    note: "Prices exclusive of 18% GST. Cancel kabhi bhi, apne aap.",
  },
  testimonials: [
    {
      quote:
        "Main har Monday ka spreadsheet dubara banata tha. Ab ek preset hai jo 6:40 pe chal jaata hai aur main chai ke saath padh leta hoon.",
      name: "Rajeev Menon",
      role: "Swing trader, Chennai",
      initials: "RM",
    },
    {
      quote:
        "Open interest ke saath ek hi query mein stock aur uska option dono dikh jaate hain. Yeh baat koi free screener nahi karta.",
      name: "Ananya Iyer",
      role: "F&O trader, Bengaluru",
      initials: "AI",
    },
    {
      quote:
        "Naya analyst ab teen meetings mein nahi baithta — woh queries padh ke hi pura process samajh leta hai. Onboarding aadha ho gaya.",
      name: "Vikram Shetty",
      role: "Proprietary desk, Mumbai",
      initials: "VS",
    },
  ],
  faq: {
    eyebrow: "Questions",
    title: "Jo log shuru karne se pehle poochte hain.",
    items: [
      {
        q: "Kunse exchanges aur indices cover hote hain?",
        a: "NSE aur BSE ke saare listed equities, cash aur F&O dono. NIFTY 50, 100, 200 aur 500, SENSEX, BANKEX, NIFTY NEXT 50, aur saare sectoral indices jaise NIFTY IT, NIFTY BANK, NIFTY PHARMA, NIFTY AUTO aur NIFTY METAL. Aap apna custom basket bhi bana sakte hain.",
      },
      {
        q: "Kya yeh investment advice hai?",
        a: "Nahi. Tessera ek research tool hai — yeh batata hai ki aapki conditions kis stock par lagi, kya karna hai yeh nahi. Hum koi SEBI-registered investment advisor nahi hain aur koi bhi recommendation nahi dete.",
      },
      {
        q: "Corporate actions history mein adjust hote hain?",
        a: "Haan. Splits, bonuses, rights issues, dividends aur demergers poore history par back-adjust kiye jaate hain. Naya NSE historical data API isko raw deta hai, isliye dobara download karne se backtest bigad jaata hai — humne woh problem hatayi hai.",
      },
      {
        q: "F&O data included hai?",
        a: "Haan. Lot sizes, expiry calendar, open interest build-up, implied volatility aur max pain sab filters aur columns dono ki tarah available hain. Aap ek hi query mein stock aur uske matching option contract dono dekh sakte hain.",
      },
      {
        q: "Scan kitna tez hai?",
        a: "Poore universe ka median scan abhi 240 milliseconds hai. Kam functions wale queries 80ms se bhi neeche aa jaate hain. Hum sirf median nahi, p99 bhi publish karte hain — kyunki akela median bahut kam batata hai.",
      },
      {
        q: "Data 15 minute late toh nahi hai?",
        a: "Intraday bars 15-minute aggregated hain, jo zyadatar screeners aur broker terminals dete hain. Daily OHLCV aur corporate actions official close ke saath update hote hain, aur aap har screen par live status dekh sakte hain.",
      },
      {
        q: "Free plan ki limit ke baad?",
        a: "Scans agle din tak ruk jaate hain aur aapko email ho jaata hai. Free plan par koi card stored nahi hota, isliye galti se charge kabhi nahi lagega.",
      },
    ],
  },
  cta: {
    title: "Kholiye scanner, aur pehli query chalaaiye.",
    body: "No card. No trial clock. No sales call. Roz 200 symbols, free, hamesha.",
    primary: { label: "Sign in", href: "/sign-in" },
    secondary: { label: "Read the FAQ", href: "#faq" },
  },
  footer: {
    blurb:
      "Ek screener jo Indian market ke liye bana ho — F&O, corporate actions aur promoter holding samet.",
    columns: [
      {
        title: "Product",
        links: ["Screener", "Presets", "Backtesting", "Alerts", "Changelog"],
      },
      {
        title: "Coverage",
        links: ["NSE & BSE", "Indices", "F&O", "Corporate actions", "Methodology"],
      },
      {
        title: "Company",
        links: ["About", "Careers", "Blog", "Contact"],
      },
      {
        title: "Legal",
        links: ["Terms", "Privacy", "Research disclosure"],
      },
    ],
    disclaimer:
      "Tessera ek research tool hai, SEBI-registered investment advisor ya broker-dealer nahi. Is website par koi bhi jaankari investment advice nahi hai. Research Analyst registration no. INH0000XXXXXX (placeholder). Market data informational purposes ke liye aur delayed ho sakta hai. F&O mein losses ho sakte hain. Investing mein risk hai, aur aapka principal poora ho sakta hai.",
  },
};
