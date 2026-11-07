// The verifier is plain code. An AI finding reaches a person only if its quote really
// exists in the draft and the rule it cites really exists in the Brand Kit.

import type { BrandKit, Finding, Severity } from "../types";
import { findSpan, tokens, uid, type Redaction } from "./text";

export interface RawAiFinding {
  quote?: unknown;
  ruleId?: unknown;
  message?: unknown;
  fix?: unknown;
  confidence?: unknown;
}

export const REVIEW_THRESHOLD = 0.6;

const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export function verifyAiFindings(
  raw: RawAiFinding[],
  original: string,
  redaction: Redaction,
  kit: BrandKit,
  existing: Finding[]
): { kept: Finding[]; dropped: number } {
  const judgementRules = new Map(kit.rules.filter((r) => !r.check).map((r) => [r.id, r]));
  const kept: Finding[] = [];
  let dropped = 0;

  for (const item of Array.isArray(raw) ? raw : []) {
    const quote = str(item.quote, 300);
    const ruleId = str(item.ruleId, 60);
    const message = str(item.message, 400);
    const rule = ruleId ? judgementRules.get(ruleId) : undefined;
    if (!quote || !rule || !message || /\[(EMAIL|PHONE|ID)\]/.test(quote)) {
      dropped++;
      continue;
    }
    const span = findSpan(redaction.text, quote);
    if (!span) {
      dropped++;
      continue;
    }
    const start = redaction.toOriginal(span.start);
    const end = redaction.toOriginal(span.end);
    const overlaps = [...existing, ...kept].some((f) => f.start >= 0 && f.start < end && f.end > start);
    if (overlaps) {
      dropped++;
      continue;
    }
    const c = typeof item.confidence === "number" ? Math.max(0, Math.min(1, item.confidence)) : 0.5;
    const severity: Severity = rule.severity;
    kept.push({
      id: uid(),
      pass: "judgement",
      type: rule.category,
      severity,
      start,
      end,
      quote: original.slice(start, end),
      message,
      cites: { kind: "rule", id: rule.id, label: `Rule ${rule.section}`, excerpt: rule.text },
      fix: str(item.fix, 400),
      confidence: c,
      needsReview: c < REVIEW_THRESHOLD,
      ai: true,
      status: "open",
    });
  }
  return { kept, dropped };
}

/** Apply a single fix to the text. */
export function applyFix(text: string, f: Pick<Finding, "start" | "end" | "fix">): string {
  if (f.fix == null || f.start < 0) return text;
  return text.slice(0, f.start) + f.fix + text.slice(f.end);
}

/**
 * Intent lock: a fix "breaks intent" when it removes words of the creator's key
 * message that were present before.
 */
export function breaksIntent(text: string, f: Pick<Finding, "start" | "end" | "fix">, keyMessage?: string | null): boolean {
  if (!keyMessage?.trim() || f.fix == null || f.start < 0) return false;
  const before = new Set(tokens(text));
  const after = new Set(tokens(applyFix(text, f)));
  const key = tokens(keyMessage).filter((t) => before.has(t));
  if (key.length === 0) return false;
  const kept = key.filter((t) => after.has(t)).length;
  return kept / key.length < 0.8;
}

const WEIGHT: Record<Severity, number> = { blocker: 18, warning: 7, suggestion: 2 };

type Scored = Pick<Finding, "severity" | "status"> & { cites?: { id: string } };

/** Brand score 0–100 over open findings. A rule broken in several places costs once, at its worst. */
export function score(findings: Scored[]): number {
  const worst = new Map<string, number>();
  findings
    .filter((f) => f.status === "open" || f.status === "disputed")
    .forEach((f, i) => {
      const key = f.cites?.id ?? `finding-${i}`;
      worst.set(key, Math.max(worst.get(key) ?? 0, WEIGHT[f.severity]));
    });
  return Math.max(0, 100 - [...worst.values()].reduce((s, w) => s + w, 0));
}
