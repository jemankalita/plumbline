// Learns from a team's own decisions, one organisation at a time. It only ever makes a check quieter,
// and never touches blockers, legal, claim or accessibility checks. Pure, so it can be replayed over history.

import type { Finding, FindingCalibration, FindingStatus, IssueType, ReasonCode, Role, Severity } from "../types";

export interface LedgerDecision {
  ruleKey: string;
  submissionId: string | null;
  ruleVersionHash: string;
  pass: string;
  type: IssueType;
  baseSeverity: Severity;
  toStatus: FindingStatus;
  reasonCode: ReasonCode | null;
  actorId: string;
  actorRole: Role;
  isDraftAuthor: boolean;
  isSeed: boolean;
  at: string;
}

export interface CalibrationPin {
  ruleKey: string;
  until: string;
}

export type CalibrationAction = "none" | "observe" | "quieten" | "demote";

export interface RuleCalibration {
  ruleKey: string;
  action: CalibrationAction;
  decided: number;
  dismissed: number;
  people: number;
  /** Estimated chance a flag from this rule is a real issue. */
  usefulness: number;
  pinnedUntil: string | null;
  simulated: boolean;
}

const PRIOR_MEAN = 0.7;
const PRIOR_STRENGTH = 4;
const GLOBAL_DECISIONS_FOR_POOLING = 30;
const HALF_LIFE_DAYS = 90;
const AUTHOR_WEIGHT = 0.25;
const MAX_PERSON_SHARE = 0.4;
const CONFIDENCE = 0.9;
const OBSERVE_AFTER = 3;
const QUIETEN = { below: 0.5, decided: 5, people: 2 };
const DEMOTE = { below: 0.35, decided: 8, people: 2 };
export const PIN_DAYS = 30;
const DAY_MS = 86400000;

const LOCKED_TYPES: ReadonlySet<IssueType> = new Set(["legal", "claim", "accessibility"]);
const FALSE_ALARM_REASONS: ReadonlySet<ReasonCode> = new Set(["wrong", "rule_outdated"]);

export const isLocked = (type: IssueType, severity: Severity) => LOCKED_TYPES.has(type) || severity === "blocker";

type Outcome = "real" | "falseAlarm" | "neutral";

function outcomeOf(d: Pick<LedgerDecision, "toStatus" | "reasonCode">): Outcome {
  if (d.toStatus === "accepted" || d.toStatus === "cleared") return "real";
  if (d.toStatus === "dismissed" && d.reasonCode && FALSE_ALARM_REASONS.has(d.reasonCode)) return "falseAlarm";
  return "neutral";
}

// ---------- the statistics ----------

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  const series = c.reduce((sum, value, i) => sum + value / (x + i + 1), 1.000000000190015);
  return -tmp + Math.log((2.5066282746310005 * series) / x);
}

function betaFraction(x: number, a: number, b: number): number {
  const TINY = 1e-30;
  const safe = (v: number) => (Math.abs(v) < TINY ? TINY : v);
  let c = 1;
  let d = 1 / safe(1 - ((a + b) * x) / (a + 1));
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const even = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 / safe(1 + even * d);
    c = safe(1 + even / c);
    h *= d * c;
    const odd = (-(a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 / safe(1 + odd * d);
    c = safe(1 + odd / c);
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-9) break;
  }
  return h;
}

/** P(θ < x) when θ ~ Beta(a, b). */
export function betaBelow(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (front * betaFraction(x, a, b)) / a : 1 - (front * betaFraction(1 - x, b, a)) / b;
}

// ---------- weighing decisions ----------

/** One person may not carry more than their share of a rule, unless there are too few people for that to be possible. */
export function capShares(weights: number[]): number[] {
  const share = Math.max(MAX_PERSON_SHARE, 1 / Math.max(1, weights.length));
  const capped = new Set<number>();
  let limit = Infinity;
  for (let changed = true; changed; ) {
    changed = false;
    const free = weights.reduce((sum, w, i) => (capped.has(i) ? sum : sum + w), 0);
    limit = (share * free) / (1 - capped.size * share);
    weights.forEach((w, i) => {
      if (!capped.has(i) && w > limit + 1e-12) {
        capped.add(i);
        changed = true;
      }
    });
  }
  return weights.map((w, i) => (capped.has(i) ? limit : w));
}

const groupKey = (d: Pick<LedgerDecision, "pass" | "type">) => `${d.pass}/${d.type}`;

/** The newest decision on each rule in each draft: one draft gets one vote, however many times it fires. */
function latestPerDraft(decisions: LedgerDecision[]): LedgerDecision[] {
  const latest = new Map<string, LedgerDecision>();
  for (const d of [...decisions].sort((a, b) => a.at.localeCompare(b.at))) latest.set(`${d.ruleKey}|${d.submissionId}`, d);
  return [...latest.values()];
}

interface Weighed {
  d: LedgerDecision;
  outcome: Exclude<Outcome, "neutral">;
  weight: number;
}

function weigh(decisions: LedgerDecision[], now: number): Weighed[] {
  return decisions.flatMap((d) => {
    const outcome = outcomeOf(d);
    if (outcome === "neutral") return [];
    const ageDays = Math.max(0, now - new Date(d.at).getTime()) / DAY_MS;
    return [{ d, outcome, weight: (d.isDraftAuthor ? AUTHOR_WEIGHT : 1) * 0.5 ** (ageDays / HALF_LIFE_DAYS) }];
  });
}

function afterShareCap(rows: Weighed[]): Weighed[] {
  const totals = new Map<string, number>();
  rows.forEach((r) => totals.set(r.d.actorId, (totals.get(r.d.actorId) ?? 0) + r.weight));
  const people = [...totals.keys()];
  const capped = capShares(people.map((p) => totals.get(p) as number));
  const scale = new Map(people.map((p, i) => [p, capped[i] / (totals.get(p) as number)]));
  return rows.map((r) => ({ ...r, weight: r.weight * (scale.get(r.d.actorId) as number) }));
}

const sumWeights = (rows: Weighed[], outcome: Weighed["outcome"]) => rows.reduce((sum, r) => (r.outcome === outcome ? sum + r.weight : sum), 0);

function actionFor(belowHalf: number, belowLow: number, decided: number, dismissed: number, people: number): CalibrationAction {
  if (belowLow >= CONFIDENCE && decided >= DEMOTE.decided && people >= DEMOTE.people) return "demote";
  if (belowHalf >= CONFIDENCE && decided >= QUIETEN.decided && people >= QUIETEN.people) return "quieten";
  return decided >= OBSERVE_AFTER && dismissed > 0 ? "observe" : "none";
}

/** Each rule's state from the decisions so far. A changed rule starts again, because old votes were about the old rule. */
export function calibrate(decisions: LedgerDecision[], pins: CalibrationPin[], now: Date, currentHash: (d: LedgerDecision) => string): Map<string, RuleCalibration> {
  const nowMs = now.getTime();
  const current = latestPerDraft(decisions.filter((d) => new Date(d.at).getTime() <= nowMs && d.ruleVersionHash === currentHash(d)));
  const weighed = weigh(current, nowMs);
  const usePooled = weighed.length >= GLOBAL_DECISIONS_FOR_POOLING;
  const result = new Map<string, RuleCalibration>();
  for (const ruleKey of new Set(current.map((d) => d.ruleKey))) {
    const own = afterShareCap(weighed.filter((r) => r.d.ruleKey === ruleKey));
    const sample = current.find((d) => d.ruleKey === ruleKey) as LedgerDecision;
    const peers = usePooled ? weighed.filter((r) => r.d.ruleKey !== ruleKey && groupKey(r.d) === groupKey(sample)) : [];
    const peerTotal = sumWeights(peers, "real") + sumWeights(peers, "falseAlarm");
    const mean = peerTotal > 0 ? Math.min(0.95, Math.max(0.05, sumWeights(peers, "real") / peerTotal)) : PRIOR_MEAN;
    const a = mean * PRIOR_STRENGTH + sumWeights(own, "real");
    const b = (1 - mean) * PRIOR_STRENGTH + sumWeights(own, "falseAlarm");
    const dismissed = own.filter((r) => r.outcome === "falseAlarm").length;
    const people = new Set(own.map((r) => r.d.actorId)).size;
    const pin = pins.find((p) => p.ruleKey === ruleKey && new Date(p.until).getTime() > nowMs);
    const action = actionFor(betaBelow(QUIETEN.below, a, b), betaBelow(DEMOTE.below, a, b), own.length, dismissed, people);
    result.set(ruleKey, {
      ruleKey,
      action: pin && action !== "none" ? "observe" : action,
      decided: own.length,
      dismissed,
      people,
      usefulness: a / (a + b),
      pinnedUntil: pin?.until ?? null,
      simulated: own.some((r) => r.d.isSeed),
    });
  }
  return result;
}

function noteFor(c: RuleCalibration, base: Severity): string {
  const who = c.simulated ? "In the simulated history, reviewers" : "Your team";
  const times = `${who} dismissed this check ${c.dismissed} of ${c.decided} times`;
  if (c.pinnedUntil) return `${times}. Someone kept it at full strength, so nothing has changed.`;
  if (c.action === "demote") return `${times}, across ${c.people} people. Lowered from ${base} to suggestion.`;
  if (c.action === "quieten") return `${times}, across ${c.people} people. Moved to low priority, and it still counts in the score.`;
  return `${times}. Nothing has changed yet.`;
}

/** Adds what the team has learned to a fresh set of findings. */
export function applyCalibration<T extends Pick<Finding, "type" | "severity" | "cites" | "calibration">>(findings: T[], rules: Map<string, RuleCalibration>): T[] {
  return findings.map((f) => {
    const c = rules.get(f.cites.id);
    if (!c || c.action === "none" || isLocked(f.type, f.severity)) return f;
    const lowered = c.action === "demote" && f.severity === "warning";
    const action = c.action === "demote" && !lowered ? "quieten" : c.action;
    const calibration: FindingCalibration = { action: action as FindingCalibration["action"], note: noteFor(c, f.severity), baseSeverity: f.severity, simulated: c.simulated };
    return { ...f, severity: lowered ? "suggestion" : f.severity, calibration };
  });
}

export interface ReplaySummary {
  decisions: number;
  /** Findings people accepted that the learner would have quietened by then. Reported first, on purpose. */
  realIssuesLost: number;
  falseAlarmsQuietened: number;
}

/** Walks history in order and asks what would have been quieter at that moment, using only what was known then. */
export function replay(decisions: LedgerDecision[]): ReplaySummary {
  const ordered = latestPerDraft(decisions).sort((a, b) => a.at.localeCompare(b.at));
  const summary: ReplaySummary = { decisions: 0, realIssuesLost: 0, falseAlarmsQuietened: 0 };
  ordered.forEach((d, i) => {
    const outcome = outcomeOf(d);
    if (outcome === "neutral" || isLocked(d.type, d.baseSeverity)) return;
    summary.decisions++;
    const earlier = ordered.slice(0, i);
    const action = calibrate(earlier, [], new Date(d.at), (x) => (x.ruleKey === d.ruleKey ? d.ruleVersionHash : x.ruleVersionHash)).get(d.ruleKey)?.action;
    if (action !== "quieten" && action !== "demote") return;
    if (outcome === "real") summary.realIssuesLost++;
    else summary.falseAlarmsQuietened++;
  });
  return summary;
}
