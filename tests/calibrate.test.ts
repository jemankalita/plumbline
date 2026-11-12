import { describe, expect, it } from "vitest";
import { applyCalibration, betaBelow, calibrate, capShares, replay, type LedgerDecision } from "../src/lib/engine/calibrate";
import type { Finding } from "../src/lib/types";

const now = new Date("2026-06-15T00:00:00Z");
const hash = () => "v1";

function decisions(count: number, patch: Partial<LedgerDecision> = {}, people = ["a", "b"]): LedgerDecision[] {
  return Array.from({ length: count }, (_, i) => ({
    ruleKey: "R-1",
    submissionId: `s${i}`,
    ruleVersionHash: "v1",
    pass: "rules",
    type: "tone",
    baseSeverity: "warning",
    toStatus: "dismissed",
    reasonCode: "wrong",
    actorId: people[i % people.length],
    actorRole: "reviewer",
    isDraftAuthor: false,
    isSeed: false,
    at: new Date(now.getTime() - i * 3600000).toISOString(),
    ...patch,
  }));
}

const finding = (patch: Partial<Finding> = {}) => ({ type: "tone", severity: "warning", cites: { id: "R-1" }, ...patch }) as Pick<Finding, "type" | "severity" | "cites" | "calibration">;

describe("what the learner does", () => {
  it("demotes a warning only after enough people agree", () => {
    const rules = calibrate(decisions(11), [], now, hash);
    expect(rules.get("R-1")?.action).toBe("demote");
    const [changed] = applyCalibration([finding()], rules);
    expect(changed.severity).toBe("suggestion");
    expect(changed.calibration?.baseSeverity).toBe("warning");
  });

  it("does nothing on one person's say-so", () => {
    expect(calibrate(decisions(20, {}, ["a"]), [], now, hash).get("R-1")?.action).toBe("observe");
  });

  it("does not count 'fair, but an exception here' as a false alarm", () => {
    expect(calibrate(decisions(20, { reasonCode: "valid_but_exception" }), [], now, hash).get("R-1")?.decided).toBe(0);
  });

  it("never touches blockers or legal, claim and accessibility checks", () => {
    const rules = calibrate(decisions(11), [], now, hash);
    for (const safe of [finding({ severity: "blocker" }), finding({ type: "legal" }), finding({ type: "claim" }), finding({ type: "accessibility" })]) {
      expect(applyCalibration([safe], rules)[0].calibration).toBeUndefined();
    }
  });

  it("starts again when the rule's meaning changes", () => {
    expect(calibrate(decisions(11), [], now, () => "v2").get("R-1")).toBeUndefined();
  });

  it("stops changing a rule someone has pinned", () => {
    const until = new Date(now.getTime() + 86400000).toISOString();
    expect(calibrate(decisions(11), [{ ruleKey: "R-1", until }], now, hash).get("R-1")?.action).toBe("observe");
  });

  it("gives one draft one vote", () => {
    expect(calibrate(decisions(11, { submissionId: "same" }), [], now, hash).get("R-1")?.decided).toBe(1);
  });
});

describe("the arithmetic", () => {
  it("matches a known beta probability", () => {
    expect(betaBelow(0.5, 2, 2)).toBeCloseTo(0.5, 6);
    expect(betaBelow(0.25, 1, 3)).toBeCloseTo(1 - 0.75 ** 3, 6);
  });

  it("limits one heavy reviewer to 40% when there are enough people", () => {
    const capped = capShares([10, 1, 1, 1]);
    expect(capped[0] / capped.reduce((a, b) => a + b, 0)).toBeCloseTo(0.4, 6);
  });
});

describe("replay", () => {
  it("reports real issues that would have been lost", () => {
    const history = [...decisions(11).map((d, i) => ({ ...d, at: new Date(now.getTime() - (20 - i) * 86400000).toISOString() })), ...decisions(1, { toStatus: "accepted", reasonCode: null, submissionId: "new", at: now.toISOString() })];
    expect(replay(history).realIssuesLost).toBe(1);
  });
});
