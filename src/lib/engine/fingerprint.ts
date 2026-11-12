// Recognises the same finding across versions of a draft, so a decision is not asked for twice.

import { createHash } from "node:crypto";
import type { Finding, FindingStatus } from "../types";

// Keys are sorted because Postgres jsonb does not keep them in the order they were written.
const sortKeys = (_: string, v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);

export const hash = (value: unknown): string => createHash("sha256").update(JSON.stringify(value, sortKeys)).digest("hex").slice(0, 16);

const normalise = (quote: string) => quote.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Same rule version + same words = same finding. Editing a rule changes the fingerprint on purpose,
 * because an old decision about an old rule should not silently apply to the new one.
 */
export function fingerprint(f: Pick<Finding, "cites" | "quote" | "start" | "frameMs">, ruleHash: string, mediaKey: string): string {
  const anchor = f.start < 0 && f.frameMs == null ? `media:${mediaKey}` : normalise(f.quote);
  return hash([f.cites.id, ruleHash, anchor]);
}

// "accepted" is left out: the fix was applied, so if the issue is back it needs a fresh look.
const CARRIED: ReadonlySet<FindingStatus> = new Set(["dismissed", "disputed", "cleared", "overridden"]);

export type Prior = Pick<Finding, "fingerprint" | "status" | "decidedBy" | "reason" | "reasonCode" | "carriedFrom" | "severity">;

/** A decision only carries if the new finding could have received it, for example a rule that became a blocker can't stay dismissed. */
const stillValid = (p: Prior, severity: Finding["severity"]) => {
  if (p.status === "dismissed") return severity !== "blocker";
  if (p.status === "overridden") return severity === "blocker";
  return true;
};

/** Gives each new finding the decision made on its match in the previous version. Each decision is used once. */
export function carryDecisions<T extends Pick<Finding, "fingerprint" | "severity">>(prior: Prior[], next: T[], priorRevision: number): T[] {
  const pool = new Map<string, Prior[]>();
  for (const p of prior) {
    if (p.fingerprint && CARRIED.has(p.status)) pool.set(p.fingerprint, [...(pool.get(p.fingerprint) ?? []), p]);
  }
  return next.map((f) => {
    const candidates = pool.get(f.fingerprint ?? "") ?? [];
    const match = candidates.find((p) => stillValid(p, f.severity));
    if (!match) return f;
    pool.set(f.fingerprint as string, candidates.filter((p) => p !== match));
    return { ...f, status: match.status, decidedBy: match.decidedBy, reason: match.reason, reasonCode: match.reasonCode, carriedFrom: match.carriedFrom ?? priorRevision };
  });
}

/**
 * Open findings the writer fixed by editing, which count as quiet agreement.
 * AI findings don't count, since a model not repeating itself says nothing about the draft.
 */
export function implicitlyAccepted<T extends Pick<Finding, "fingerprint" | "status" | "ai" | "start" | "quote">>(prior: T[], nextFingerprints: Set<string>, newText: string): T[] {
  return prior.filter((p) => p.status === "open" && !p.ai && p.start >= 0 && !nextFingerprints.has(p.fingerprint ?? "") && !newText.includes(p.quote));
}
