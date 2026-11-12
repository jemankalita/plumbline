// Decides which of the engine's findings count as correct against the reference labels.

export interface GoldLabel {
  quote: string;
  start: number;
  end: number;
  citeId: string;
}

export interface Predicted {
  start: number; // -1 when the model quoted words that aren't in the text
  end: number;
  citeId: string;
}

export interface Span {
  start: number;
  end: number;
}

export type MatchMode = "strict" | "lenient";

export interface MatchResult {
  matched: number;
  falsePositives: Predicted[];
  missed: GoldLabel[];
}

const STRICT_OVERLAP = 0.5;

function charOverlap(a: Span, b: Span): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
}

function iou(a: Span, b: Span): number {
  const common = charOverlap(a, b);
  return common === 0 ? 0 : common / (a.end - a.start + (b.end - b.start) - common);
}

const inSameSentence = (a: Span, b: Span, sentences: Span[]) => sentences.some((s) => charOverlap(s, a) > 0 && charOverlap(s, b) > 0);

/** How well a finding fits a label, 0 when it doesn't count. */
function fit(pred: Predicted, gold: GoldLabel, bySentence: boolean, sentences: Span[], mode: MatchMode): number {
  if (pred.citeId !== gold.citeId || pred.start < 0) return 0;
  const overlap = iou(pred, gold);
  if (mode === "lenient") return overlap > 0 || inSameSentence(pred, gold, sentences) ? Math.max(overlap, 0.01) : 0;
  if (bySentence) return inSameSentence(pred, gold, sentences) ? Math.max(overlap, 0.01) : 0;
  return overlap >= STRICT_OVERLAP ? overlap : 0;
}

export interface MatchInput {
  gold: GoldLabel[];
  ambiguous: GoldLabel[];
  predicted: Predicted[];
  sentences: Span[];
  /** Tone and messaging are judged per sentence, because people quote those differently. */
  bySentence: (citeId: string) => boolean;
  mode: MatchMode;
}

/** Best pairs first, each label and finding used once. A finding on an ambiguous label is neither right nor wrong. */
export function matchPost({ gold, ambiguous, predicted, sentences, bySentence, mode }: MatchInput): MatchResult {
  const pairs = predicted
    .flatMap((pred, p) => gold.map((label, g) => ({ p, g, score: fit(pred, label, bySentence(pred.citeId), sentences, mode) })))
    .filter((pair) => pair.score > 0)
    .sort((a, b) => b.score - a.score);
  const usedPredictions = new Set<number>();
  const usedGold = new Set<number>();
  for (const { p, g } of pairs) {
    if (usedPredictions.has(p) || usedGold.has(g)) continue;
    usedPredictions.add(p);
    usedGold.add(g);
  }
  const onAmbiguous = (pred: Predicted) => ambiguous.some((label) => fit(pred, label, bySentence(pred.citeId), sentences, "lenient") > 0);
  return {
    matched: usedGold.size,
    falsePositives: predicted.filter((pred, i) => !usedPredictions.has(i) && !onAmbiguous(pred)),
    missed: gold.filter((_, i) => !usedGold.has(i)),
  };
}
