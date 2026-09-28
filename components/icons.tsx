import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function TerminalIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 17.5 9 12l-5-5.5" />
      <path d="M12 18h8" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M13.5 2 4 13.5h6.5L10.5 22 20 10.5h-6.5z" />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 8.5 4.5L12 12 3.5 7.5z" />
      <path d="m3.5 12.5 8.5 4.5 8.5-4.5" />
      <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
    </svg>
  );
}

export function WaveIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 12c1.6-4.5 3.2-4.5 4.8 0s3.2 4.5 4.8 0 3.2-4.5 4.8 0 3.2 4.5 4.8 0" />
      <path d="M2 17.5c1.6-2.5 3.2-2.5 4.8 0s3.2 2.5 4.8 0 3.2-2.5 4.8 0 3.2 2.5 4.8 0" opacity={0.45} />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4.2 1.5 5.5 1.5 5.5h-15S6 13.2 6 9z" />
      <path d="M10.2 18.5a2 2 0 0 0 3.6 0" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <svg {...base} {...props} strokeWidth={1} opacity={0.5}>
      <path d="M9.5 5.5C6.5 7 5 9.4 5 12.6c0 2.6 1.4 4.4 3.4 4.4 1.8 0 3.1-1.3 3.1-3 0-1.8-1.2-3-2.9-3-.3 0-.6 0-.8.1.4-1.5 1.6-2.8 3.3-3.7zM20.5 5.5c-3 1.5-4.5 3.9-4.5 7.1 0 2.6 1.4 4.4 3.4 4.4 1.8 0 3.1-1.3 3.1-3 0-1.8-1.2-3-2.9-3-.3 0-.6 0-.8.1.4-1.5 1.6-2.8 3.3-3.7z" />
    </svg>
  );
}

export const featureIcons = {
  terminal: TerminalIcon,
  bolt: BoltIcon,
  layers: LayersIcon,
  wave: WaveIcon,
  bookmark: BookmarkIcon,
  bell: BellIcon,
} as const;

export type FeatureIconName = keyof typeof featureIcons;
