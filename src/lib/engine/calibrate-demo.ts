// Simulated decisions, so the learning can be seen in a demo before a team has made any.
// Always labelled Simulated on screen and never counted in real statistics.

import { rngFrom } from "../eval/seeded";
import type { IssueType, Role, Severity } from "../types";
import type { LedgerDecision } from "./calibrate";

const DAY_MS = 86400000;

const base = (ruleKey: string, type: IssueType, severity: Severity, hash: string) => ({
  ruleKey,
  ruleVersionHash: hash,
  pass: "rules",
  type,
  baseSeverity: severity,
  isDraftAuthor: false,
  isSeed: true,
});

/** A short history for one low-stakes rule, so a judge sees a check go quiet and can read why. */
export function simulatedHistory(ruleKey: string, hash: string, now: Date): LedgerDecision[] {
  const people: Role[] = ["reviewer", "approver"];
  return Array.from({ length: 7 }, (_, i) => ({
    ...base(ruleKey, "readability", "suggestion", hash),
    submissionId: `simulated-${i}`,
    toStatus: "dismissed" as const,
    reasonCode: "wrong" as const,
    actorId: `simulated:${people[i % 2]}`,
    actorRole: people[i % 2],
    at: new Date(now.getTime() - (i + 1) * 3 * DAY_MS).toISOString(),
  }));
}

const RULE_USEFULNESS = [0.92, 0.88, 0.85, 0.8, 0.7, 0.6, 0.3, 0.2];
const DECISIONS_PER_RULE = 40;
const SPAN_DAYS = 180;

/** Eight imagined rules, some good and some poor, for a chronological replay. */
export function simulatedTimeline(seed: number, now: Date): LedgerDecision[] {
  const rng = rngFrom(seed);
  const people: Role[] = ["reviewer", "approver", "admin"];
  return RULE_USEFULNESS.flatMap((usefulness, r) =>
    Array.from({ length: DECISIONS_PER_RULE }, (_, i) => {
      const actor = people[Math.floor(rng() * people.length)];
      const real = rng() < usefulness;
      return {
        ...base(`simulated-rule-${r}`, "tone", "warning", "simulated"),
        submissionId: `simulated-${r}-${i}`,
        toStatus: real ? ("accepted" as const) : ("dismissed" as const),
        reasonCode: real ? null : ("wrong" as const),
        actorId: `simulated:${actor}`,
        actorRole: actor,
        at: new Date(now.getTime() - rng() * SPAN_DAYS * DAY_MS).toISOString(),
      };
    })
  );
}
