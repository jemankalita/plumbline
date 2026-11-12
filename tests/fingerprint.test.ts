import { describe, expect, it } from "vitest";
import { carryDecisions, fingerprint, hash, implicitlyAccepted } from "../src/lib/engine/fingerprint";
import { patternProblem } from "../src/lib/engine/regex-safety";

const cites = { kind: "rule" as const, id: "R-1", label: "Rule 1", excerpt: "" };

describe("carrying decisions across versions", () => {
  it("keeps a dismissal on the same words and uses it only once", () => {
    const prior = [{ fingerprint: "a", status: "dismissed" as const, decidedBy: "creator" as const, reason: null, reasonCode: "wrong" as const, severity: "warning" as const }];
    const next = [{ fingerprint: "a", severity: "warning" as const }, { fingerprint: "a", severity: "warning" as const }];
    const [first, second] = carryDecisions(prior, next, 1) as (typeof next[number] & { status?: string; carriedFrom?: number })[];
    expect(first.status).toBe("dismissed");
    expect(first.carriedFrom).toBe(1);
    expect(second.status).toBeUndefined();
  });

  it("does not keep a dismissal once the rule has become a blocker", () => {
    const prior = [{ fingerprint: "a", status: "dismissed" as const, severity: "warning" as const }];
    const [only] = carryDecisions(prior, [{ fingerprint: "a", severity: "blocker" as const }], 1) as { status?: string }[];
    expect(only.status).toBeUndefined();
  });

  it("gives a new fingerprint when the rule text changes", () => {
    const f = { cites, quote: "Best  Price", start: 0 };
    expect(fingerprint(f, "v1", "none")).toBe(fingerprint({ ...f, quote: "best price" }, "v1", "none"));
    expect(fingerprint(f, "v1", "none")).not.toBe(fingerprint(f, "v2", "none"));
  });

  it("hashes the same whatever order the keys are in", () => {
    expect(hash({ a: 1, b: { c: 2, d: 3 } })).toBe(hash({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it("does not treat an AI finding that went quiet as accepted", () => {
    const open = { fingerprint: "a", status: "open" as const, ai: false, start: 3, quote: "guys" };
    const ai = { ...open, fingerprint: "b", ai: true };
    expect(implicitlyAccepted([open, ai], new Set(), "hello everyone")).toEqual([open]);
  });
});

describe("rule pattern limits", () => {
  it("refuses patterns that could hang the server", () => {
    expect(patternProblem("(a+)+$")).toMatch(/hang/);
    expect(patternProblem("(a|b)*c")).toMatch(/hang/);
    expect(patternProblem("(unclosed")).toMatch(/valid/);
    expect(patternProblem("\\b(guys|bro)\\b")).toBeNull();
  });
});
