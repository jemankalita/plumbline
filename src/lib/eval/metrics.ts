// Scores and trust badges. A number is only shown with how much it can be trusted.

const Z_95 = 1.96;
const USABLE_ALPHA = 0.667;
const STRONG_EVIDENCE = 30;
const SOME_EVIDENCE = 10;

export interface Tally {
  tp: number;
  fp: number;
  fn: number;
}

export const emptyTally = (): Tally => ({ tp: 0, fp: 0, fn: 0 });

export const addTally = (a: Tally, b: Tally): Tally => ({ tp: a.tp + b.tp, fp: a.fp + b.fp, fn: a.fn + b.fn });

export interface Interval {
  value: number | null;
  low: number | null;
  high: number | null;
}

/** Wilson score interval, which behaves sensibly on small counts. */
export function wilson(successes: number, total: number): Interval {
  if (total === 0) return { value: null, low: null, high: null };
  const p = successes / total;
  const z2 = Z_95 * Z_95;
  const centre = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margin = (Z_95 * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / (1 + z2 / total);
  return { value: p, low: Math.max(0, centre - margin), high: Math.min(1, centre + margin) };
}

export const precision = (t: Tally) => wilson(t.tp, t.tp + t.fp);
export const recall = (t: Tally) => wilson(t.tp, t.tp + t.fn);

export type Badge = "Measured" | "AI-referenced" | "Indicative" | "Not enough evidence" | "Labels disagree";

export interface Evidence {
  /** Cases with truth known by construction: seeded errors. */
  knownTruth: number;
  /** Real cases in the reference labels. */
  labelled: number;
  alpha: number | null;
}

export function badge({ knownTruth, labelled, alpha }: Evidence): Badge {
  if (knownTruth >= STRONG_EVIDENCE) return "Measured";
  if (alpha !== null && alpha < USABLE_ALPHA) return "Labels disagree";
  if (labelled >= STRONG_EVIDENCE && alpha !== null) return "AI-referenced";
  if (labelled >= SOME_EVIDENCE) return "Indicative";
  return "Not enough evidence";
}

export const labelsUsable = (alpha: number | null) => alpha === null || alpha >= USABLE_ALPHA;
