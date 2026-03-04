"use client";

import { memo } from "react";

/** Ícone play com label (1x, 20x, 100x, 1000x). Um único componente em vez de 4 SVGs separados. */
export const PlayBIcon = memo(function PlayBIcon({ label, alt }: { label: string; alt: string }) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 60 60"
      className="w-9 h-9 object-contain"
      aria-hidden
      role="img"
    >
      <defs>
        <linearGradient id="playB-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0" stopColor="#fabf25" />
          <stop offset="1" stopColor="#979797" />
        </linearGradient>
        <linearGradient id="playB-stroke" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#000" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="27" fill="#3682e7" stroke="#000" strokeWidth="2" />
      <polygon points="25,38 41,28 25,18" fill="#b5a787" />
      <rect
        x="4.27"
        y="36.56"
        width="52.32"
        height="18.86"
        rx="3.42"
        fill="url(#playB-grad)"
        stroke="url(#playB-stroke)"
        strokeWidth="0.4"
      />
      <text
        x="30"
        y="51.76"
        fontSize="17.45"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="bold"
        fill="#000"
        textAnchor="middle"
      >
        {label}
      </text>
    </svg>
  );
});
