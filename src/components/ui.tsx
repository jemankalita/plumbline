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
  primary: "bg-lime text-soot hover:bg-lime-600",
  secondary: "bg-white text-ink ring-1 ring-inset ring-ash-200 hover:bg-ash-50 hover:ring-ash-300",
  ghost: "text-ink hover:bg-ash-100",
  danger: "bg-white text-red-700 ring-1 ring-inset ring-red/30 hover:bg-red-50",
  success: "bg-ink text-white hover:bg-soot-3",
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
        "transition-[transform,background-color,box-shadow,color] duration-150 ease-out active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-11 px-4 text-[15px]",
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
  blocker: { label: "Blocker", cls: "bg-red text-white ring-red", dot: "bg-white" },
  warning: { label: "Warning", cls: "bg-amber-50 text-amber-700 ring-amber", dot: "bg-amber" },
  suggestion: { label: "Suggestion", cls: "bg-white text-ash-700 ring-ash-400", dot: "bg-ash-500" },
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
  supported: { label: "Supported", cls: "text-green-700 bg-green-50" },
  unsupported: { label: "Unsupported", cls: "text-red-700 bg-red-50" },
  outdated: { label: "Outdated", cls: "text-amber-700 bg-amber-50" },
  contradicted: { label: "Contradicted", cls: "text-amber-700 bg-amber-50" },
};

export const STATUS: Record<SubmissionStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-white text-ink ring-ash-200" },
  in_review: { label: "Awaiting approval", cls: "bg-lime text-soot ring-lime-600" },
  changes_requested: { label: "Changes requested", cls: "bg-amber-50 text-amber-700 ring-amber/25" },
  approved: { label: "Approved", cls: "bg-green-50 text-green-700 ring-green/25" },
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
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[12.5px] font-medium leading-5 ring-1 ring-inset", className)}>
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
  if (score >= 85) return { stroke: "var(--color-green)", text: "text-green-700", word: "On brand" };
  if (score >= 60) return { stroke: "var(--color-amber)", text: "text-amber-700", word: "Needs work" };
  return { stroke: "var(--color-red)", text: "text-red-700", word: "Off brand" };
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
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ash-200)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone.stroke}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={c}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      {label && (
        <motion.span className={cx("num absolute font-display font-semibold leading-none tracking-[-0.04em]", tone.text)} style={{ fontSize: size * 0.36 }}>
          {shown}
        </motion.span>
      )}
    </div>
  );
}

// ---------- misc ----------

export function Logo({ className, tone = "ink" }: { className?: string; tone?: "ink" | "paper" }) {
  const c = tone === "ink" ? "var(--color-ink)" : "#fff";
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <svg viewBox="0 0 14 24" className="h-6 w-3.5" aria-hidden>
        <rect x="6.4" y="0" width="1.2" height="12" fill={c} />
        <path d="M7 11 L12 17 L7 24 L2 17 Z" fill="var(--color-lime)" stroke={c} strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
      <span className="text-[21px] font-semibold leading-none tracking-[-0.04em]" style={{ color: c }}>
        Plumbline
      </span>
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-lg bg-white ring-1 ring-line", className)}>{children}</div>;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={htmlFor} className="text-[14px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-[13px] text-muted">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-ash-200 bg-white px-3 py-2 text-[15px] text-ink placeholder:text-ash-500 transition-[border-color,box-shadow] duration-150 focus:border-ink focus:outline-none focus:ring-2 focus:ring-lime";

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-[14px] text-red-700"
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
