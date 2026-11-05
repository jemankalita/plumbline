"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Loader2 } from "lucide-react";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { ClaimStatus, FindingStatus, IssueType, Severity, SubmissionStatus } from "@/lib/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** fetch wrapper for our { ok, data, error } envelope. Throws a readable Error. */
export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown; form?: FormData }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body || init?.form ? "POST" : "GET"),
    headers: init?.form ? undefined : { "content-type": "application/json" },
    body: init?.form ?? (init?.body !== undefined ? JSON.stringify(init.body) : undefined),
  }).catch(() => null);
  if (!res) throw new Error("Network error. Check your connection and try again.");
  const json = (await res.json().catch(() => null)) as { ok: boolean; data?: T; error?: string } | null;
  if (!json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
  return json.data as T;
}

// ---------- button ----------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const VARIANT: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-sky-700 shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_6px_16px_-8px_rgb(13_34_54/0.6)]",
  secondary: "bg-white text-navy border border-line hover:border-sky-300 hover:bg-sky-50",
  ghost: "text-ink hover:bg-sky-100/70",
  danger: "bg-white text-coral-700 border border-coral/30 hover:bg-coral-50",
  success: "bg-mint text-white hover:bg-mint-700",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx(
        "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium",
        "transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-4 text-sm",
        VARIANT[variant],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

// ---------- labels and badges ----------

export const SEVERITY: Record<Severity, { label: string; cls: string; dot: string }> = {
  blocker: { label: "Blocker", cls: "bg-coral-50 text-coral-700 ring-coral/25", dot: "bg-coral" },
  warning: { label: "Warning", cls: "bg-amber-50 text-amber-700 ring-amber/25", dot: "bg-amber" },
  suggestion: { label: "Suggestion", cls: "bg-sky-100 text-sky-700 ring-sky-400/25", dot: "bg-sky-400" },
};

export const ISSUE: Record<IssueType, string> = {
  terminology: "Terminology",
  tone: "Tone",
  messaging: "Messaging",
  claim: "Claim",
  readability: "Readability",
  accessibility: "Accessibility",
  visual: "Visual",
  legal: "Legal",
};

export const CLAIM: Record<ClaimStatus, { label: string; cls: string }> = {
  supported: { label: "Supported", cls: "text-mint-700 bg-mint-50" },
  unsupported: { label: "Unsupported", cls: "text-coral-700 bg-coral-50" },
  outdated: { label: "Outdated", cls: "text-amber-700 bg-amber-50" },
  contradicted: { label: "Contradicted", cls: "text-amber-700 bg-amber-50" },
};

export const STATUS: Record<SubmissionStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-white text-ink ring-line" },
  in_review: { label: "Awaiting approval", cls: "bg-sky-100 text-sky-700 ring-sky-300/50" },
  changes_requested: { label: "Changes requested", cls: "bg-amber-50 text-amber-700 ring-amber/25" },
  approved: { label: "Approved", cls: "bg-mint-50 text-mint-700 ring-mint/25" },
};

export const DECISION: Record<FindingStatus, string> = {
  open: "Open",
  accepted: "Fix accepted",
  dismissed: "Dismissed",
  disputed: "Disputed",
  cleared: "Cleared by reviewer",
  overridden: "Overridden",
};

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.08em] ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}

export function SeverityBadge({ s }: { s: Severity }) {
  return (
    <Pill className={SEVERITY[s].cls}>
      <span className={cx("size-1.5 rounded-full", SEVERITY[s].dot)} aria-hidden />
      {SEVERITY[s].label}
    </Pill>
  );
}

export function StatusPill({ s }: { s: SubmissionStatus }) {
  return <Pill className={STATUS[s].cls}>{STATUS[s].label}</Pill>;
}

// ---------- score ring ----------

export function scoreTone(score: number) {
  if (score >= 85) return { stroke: "var(--color-mint)", text: "text-mint-700", word: "On brand" };
  if (score >= 60) return { stroke: "var(--color-amber)", text: "text-amber-700", word: "Needs work" };
  return { stroke: "var(--color-coral)", text: "text-coral-700", word: "Off brand" };
}

export function ScoreRing({ score, size = 64, stroke = 6, label = true }: { score: number; size?: number; stroke?: number; label?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = useMotionValue(0);
  const offset = useTransform(value, (v) => c - (v / 100) * c);
  const shown = useTransform(value, (v) => Math.round(v).toString());
  useEffect(() => {
    const controls = animate(value, score, { duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [score, value]);
  const tone = scoreTone(score);
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={`Brand score ${score} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-sky-100)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      {label && (
        <motion.span className={cx("num absolute font-serif leading-none", tone.text)} style={{ fontSize: size * 0.36 }}>
          {shown}
        </motion.span>
      )}
    </div>
  );
}

// ---------- misc ----------

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
        <line x1="12" y1="1.5" x2="12" y2="14" stroke="var(--color-navy)" strokeWidth="1.6" />
        <path d="M12 13.5 L16 18.5 L12 23 L8 18.5 Z" fill="var(--color-sky-600)" />
        <rect x="6" y="1" width="12" height="2.2" rx="1.1" fill="var(--color-navy)" />
      </svg>
      <span className="font-serif text-[22px] leading-none tracking-tight text-navy">Plumbline</span>
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-line bg-white shadow-soft", className)}>{children}</div>;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-navy">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-navy placeholder:text-muted/70 transition-[border-color,box-shadow] duration-150 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-100";

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="rounded-lg border border-coral/25 bg-coral-50 px-3 py-2 text-[13px] text-coral-700"
    >
      {error}
    </motion.p>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
