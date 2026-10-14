/**
 * Inline SVG icons: no icon font or image requests. Each icon is
 * decorative (aria-hidden) and draws in currentColor, so its colour comes
 * from the CSS around it.
 */

import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

function Svg({ size = 24, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** The SafeGirl mark: a white heart in a purple-gradient circle. */
export function LogoMark({ size = 32 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="sg-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--primary)" }} />
          <stop offset="1" style={{ stopColor: "var(--primary-end)" }} />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#sg-logo-gradient)" />
      <path
        style={{ fill: "var(--on-primary)" }}
        d="M50 75 C31 62 24 52 24 41 C24 32 31 26 38.5 26 C44 26 48 29.5 50 34 C52 29.5 56 26 61.5 26 C69 26 76 32 76 41 C76 52 69 62 50 75 Z"
      />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" />
    </Svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

export function PillIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect
        x="3"
        y="8.5"
        width="18"
        height="7"
        rx="3.5"
        transform="rotate(-45 12 12)"
      />
      <path d="M9.5 9.5l5 5" />
    </Svg>
  );
}

export function SproutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6z" />
      <path d="M12 14c0-4 3-6 7-6 0 4-3 6-7 6z" />
    </Svg>
  );
}

export function FlowerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 9.5c-1.5-2-1.5-4.5 0-6 1.5 1.5 1.5 4 0 6z" />
      <path d="M14.5 12c2-1.5 4.5-1.5 6 0-1.5 1.5-4 1.5-6 0z" />
      <path d="M12 14.5c1.5 2 1.5 4.5 0 6-1.5-1.5-1.5-4 0-6z" />
      <path d="M9.5 12c-2 1.5-4.5 1.5-6 0 1.5-1.5 4-1.5 6 0z" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
      <path d="M5 19c3-4 6-6 9-8" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v5h-5" />
    </Svg>
  );
}
