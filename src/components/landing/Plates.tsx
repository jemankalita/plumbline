"use client";

/**
 * Plumb line bob illustration used for the machine step in "How it works".
 */

const SOOT = "#0f0f0f";
const CREAM = "#f1e9d6";
const LIME = "#dafa9c";
const L = { stroke: CREAM, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round", fill: "none" } as const;

/** The plumb bob on its own, for the machine step in "How it works". */
export function PlumbArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <path d="M30 18 L90 18" {...L} strokeWidth={5} />
      <path d="M60 18 L60 62" {...L} strokeWidth={1.6} />
      <path d="M60 60 l14 18 -14 26 -14 -26 Z" fill={LIME} stroke={SOOT} strokeWidth={2} />
    </svg>
  );
}
