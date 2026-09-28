export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect
        x="1"
        y="1"
        width="22"
        height="22"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.35"
      />
      <path
        d="M5 15.5 9 10.5l3.2 3.4L19 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="19" cy="6.5" r="1.9" fill="currentColor" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="font-display text-[1.4rem] leading-none tracking-tight">
      Tessera
    </span>
  );
}
