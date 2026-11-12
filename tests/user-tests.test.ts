import { describe, expect, it } from "vitest";
import { USER_FIXES, USER_TESTERS } from "@/lib/user-tests";

describe("user test record", () => {
  it("matches the totals published in the Round 3 document", () => {
    expect(USER_TESTERS).toHaveLength(4);
    expect(USER_TESTERS.reduce((n, t) => n + t.worked.length, 0)).toBe(9);
    expect(USER_FIXES).toHaveLength(10);
  });

  it("credits every problem to someone who took part", () => {
    const names = new Set(USER_TESTERS.map((t) => t.name));
    const credited = USER_FIXES.map((item) => item.foundBy);
    expect(credited.every((name) => names.has(name))).toBe(true);
  });
});
