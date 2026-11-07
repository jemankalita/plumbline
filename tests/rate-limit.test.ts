import { beforeEach, describe, expect, it } from "vitest";
import { checkLimit, clearLimits, clientKey } from "@/lib/rate-limit";

const NOW = 1_000_000;
const rule = { limit: 2, windowMs: 1000 };

describe("checkLimit", () => {
  beforeEach(clearLimits);

  it("allows requests up to the limit and refuses the next", () => {
    expect(checkLimit("a", rule, NOW)).toBe(true);
    expect(checkLimit("a", rule, NOW)).toBe(true);
    expect(checkLimit("a", rule, NOW)).toBe(false);
  });

  it("keeps each client separate", () => {
    checkLimit("a", rule, NOW);
    checkLimit("a", rule, NOW);
    expect(checkLimit("b", rule, NOW)).toBe(true);
  });

  it("allows requests again after the window passes", () => {
    checkLimit("a", rule, NOW);
    checkLimit("a", rule, NOW);
    expect(checkLimit("a", rule, NOW + 1001)).toBe(true);
  });
});

describe("clientKey", () => {
  it("uses the first forwarded address", () => {
    expect(clientKey(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } }))).toBe("1.2.3.4");
  });

  it("falls back to one shared key", () => {
    expect(clientKey(new Request("http://x"))).toBe("unknown");
  });
});
