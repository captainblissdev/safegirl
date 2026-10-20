/**
 * Inline SVG icons: no icon font or image requests. Each icon is
 * decorative (aria-hidden) and draws in currentColor, so its colour comes
 * from the CSS around it.
 */

import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  /** Line width; 2 unless set (the splash promise icons use 2.2). */
  strokeWidth?: number;
}

function Svg({
  size = 24,
  strokeWidth = 2,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/**
 * The SafeGirl mark: a shield with a heart inside, on a rounded tile. One
 * shared mark for the header and the splash; only its colours differ,
 * and they come from CSS (.mark--header, .mark--splash), never from here.
 * - "header": a violet-to-rose gradient tile, white shield and heart.
 * - "splash": a white-to-pink tile, violet shield, rose heart.
 */
export function ShieldHeartMark({
  variant = "header",
  size = 36,
}: {
  variant?: "header" | "splash";
  size?: number;
}) {
  const glyph = Math.round(size * 0.62);
  return (
    <span
      className={`mark mark--${variant}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={glyph}
        height={glyph}
        viewBox="0 0 24 24"
        fill="none"
        focusable="false"
      >
        <path
          className="mark-shield"
          d="M12 2.5l8 3.2v5.6c0 5-3.4 9.3-8 10.9-4.6-1.6-8-5.9-8-10.9V5.7l8-3.2z"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          className="mark-heart"
          d="M12 16.4c-2.9-1.9-4.3-3.5-4.3-5.3 0-1.3 1-2.4 2.4-2.4.8 0 1.5.4 1.9 1.1.4-.7 1.1-1.1 1.9-1.1 1.4 0 2.4 1.1 2.4 2.4 0 1.8-1.4 3.4-4.3 5.3z"
        />
      </svg>
    </span>
  );
}

/** The greeting's mascot: a smiling heart in the primary gradient. */
export function MascotHeart({ size = 44 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="sg-mascot-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--primary)" }} />
          <stop offset="1" style={{ stopColor: "var(--primary-end)" }} />
        </linearGradient>
      </defs>
      <path
        fill="url(#sg-mascot-gradient)"
        d="M50 90 C18 68 6 52 6 33 C6 17 18 7 31 7 C40 7 46 12 50 19 C54 12 60 7 69 7 C82 7 94 17 94 33 C94 52 82 68 50 90 Z"
      />
      <circle cx="36" cy="38" r="5" style={{ fill: "var(--on-primary)" }} />
      <circle cx="64" cy="38" r="5" style={{ fill: "var(--on-primary)" }} />
      <path
        d="M37 52 Q50 64 63 52"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        style={{ stroke: "var(--on-primary)" }}
      />
    </svg>
  );
}

/** A small four-pointed sparkle, for decoration. */
export function Sparkle({ size = 16 }: IconProps) {
  return (
    <svg
      className="sparkle"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 0 C13 7 17 11 24 12 C17 13 13 17 12 24 C11 17 7 13 0 12 C7 11 11 7 12 0 Z"
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
      <path
        d="M12 8H7a4 4 0 0 0 0 8h5z"
        fill="currentColor"
        fillOpacity="0.3"
      />
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <path d="M12 8v8" />
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
      <circle cx="12" cy="6.6" r="3.2" />
      <circle cx="17.1" cy="10.3" r="3.2" />
      <circle cx="15.2" cy="16.4" r="3.2" />
      <circle cx="8.8" cy="16.4" r="3.2" />
      <circle cx="6.9" cy="10.3" r="3.2" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </Svg>
  );
}

/** A drop, for the Periods and health topic. */
export function DropIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3c3.5 4.4 6 7.9 6 11a6 6 0 0 1-12 0c0-3.1 2.5-6.6 6-11z" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function SpeechIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12z" />
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

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function QuestionIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.6 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.1 6.1l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" />
    </Svg>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5" />
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
