import { describe, expect, it } from "vitest";
import { matchPost, type GoldLabel } from "../src/lib/eval/match";
import { badge, wilson } from "../src/lib/eval/metrics";
import { parseMarked } from "../src/lib/eval/seeded";

const gold: GoldLabel = { quote: "click", start: 10, end: 15, citeId: "a" };
const base = { ambiguous: [], sentences: [{ start: 0, end: 30 }], bySentence: () => false, mode: "strict" as const };

describe("matching findings to labels", () => {
  it("uses each label once, so two findings on one error count one wrong", () => {
    const predicted = [{ start: 10, end: 15, citeId: "a" }, { start: 10, end: 15, citeId: "a" }];
    const result = matchPost({ ...base, gold: [gold], predicted });
    expect(result.matched).toBe(1);
    expect(result.falsePositives).toHaveLength(1);
  });

  it("does not count a finding citing a different rule", () => {
    const result = matchPost({ ...base, gold: [gold], predicted: [{ start: 10, end: 15, citeId: "b" }] });
    expect(result.matched).toBe(0);
    expect(result.missed).toEqual([gold]);
  });

  it("does not mark a finding wrong when the label is ambiguous", () => {
    const result = matchPost({ ...base, gold: [], ambiguous: [gold], predicted: [{ start: 10, end: 15, citeId: "a" }] });
    expect(result.falsePositives).toEqual([]);
  });
});

describe("trust", () => {
  it("gives a sensible interval on a small sample", () => {
    const interval = wilson(9, 10);
    expect(interval.value).toBeCloseTo(0.9);
    expect(interval.low).toBeGreaterThan(0.55);
    expect(interval.high).toBeLessThan(1);
  });

  it("refuses to trust labels people could not agree on", () => {
    expect(badge({ knownTruth: 0, labelled: 200, alpha: 0.5 })).toBe("Labels disagree");
    expect(badge({ knownTruth: 30, labelled: 0, alpha: 0.5 })).toBe("Measured");
    expect(badge({ knownTruth: 0, labelled: 40, alpha: 0.8 })).toBe("AI-referenced");
    expect(badge({ knownTruth: 0, labelled: 12, alpha: 0.8 })).toBe("Indicative");
    expect(badge({ knownTruth: 0, labelled: 4, alpha: 0.8 })).toBe("Not enough evidence");
  });
});

describe("planted errors", () => {
  it("records exactly where each one is", () => {
    const { text, gold: found } = parseMarked("Please [[click]] here.", "a");
    expect(text).toBe("Please click here.");
    expect(text.slice(found[0].start, found[0].end)).toBe("click");
  });
});
