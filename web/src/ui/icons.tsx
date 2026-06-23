import type { Mode } from "../state/scene";

const S = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none" } as const;

export function ModeIcon({ mode }: { mode: Mode }) {
  switch (mode) {
    case "p2p":
      return (
        <svg {...S}>
          <line x1="3" y1="13" x2="13" y2="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="3" cy="13" r="2.2" fill="currentColor" />
          <circle cx="13" cy="3" r="2.2" fill="currentColor" />
        </svg>
      );
    case "bidir":
      return (
        <svg {...S}>
          <circle cx="3" cy="8" r="2.1" fill="currentColor" />
          <circle cx="13" cy="8" r="2.1" fill="currentColor" />
          <path d="M5.2 6.4 L8 8 L5.2 9.6" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.8 6.4 L8 8 L10.8 9.6" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "race":
      return (
        <svg {...S}>
          <rect x="2.5" y="3" width="4" height="10" rx="1" fill="currentColor" />
          <rect x="9.5" y="6" width="4" height="7" rx="1" fill="currentColor" />
        </svg>
      );
    case "alt":
      return (
        <svg {...S}>
          <circle cx="3" cy="8" r="2" fill="currentColor" />
          <circle cx="13" cy="8" r="2" fill="currentColor" />
          <path d="M4.6 7 Q8 2.5 11.4 7" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M4.6 9 Q8 13.5 11.4 9" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "iso":
      return (
        <svg {...S}>
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="8" r="2.6" fill="currentColor" />
        </svg>
      );
    case "multi":
      return (
        <svg {...S}>
          <circle cx="3.5" cy="8" r="1.9" fill="currentColor" />
          <circle cx="8" cy="8" r="1.9" fill="currentColor" />
          <circle cx="12.5" cy="8" r="1.9" fill="currentColor" />
        </svg>
      );
    case "dispatch":
      return (
        <svg {...S}>
          <rect x="3" y="3" width="4" height="4" rx="1" fill="currentColor" />
          <rect x="9" y="3" width="4" height="4" rx="1" fill="currentColor" />
          <rect x="3" y="9" width="4" height="4" rx="1" fill="currentColor" />
          <rect x="9" y="9" width="4" height="4" rx="1" fill="currentColor" />
        </svg>
      );
  }
}

export function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="5" r="1" fill="currentColor" />
      <path d="M8 7.4 V11.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ display: "block" }}>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" />
      <circle cx="7.5" cy="16.5" r="2.4" fill="var(--accent-ink)" />
      <circle cx="16.5" cy="7.5" r="2.4" fill="var(--accent-ink)" />
      <path d="M7.5 16.5 L16.5 7.5" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
