import { describe, expect, it } from "vitest";
import { runReview } from "@/lib/engine";
import { checkClaims, extractClaims, formatValue } from "@/lib/engine/claims";
import { contrast, hexToRgb } from "@/lib/engine/color";
import { checkImage, checkTerms, checkTextRules } from "@/lib/engine/rules";
import { findSpan, numbers, redact, sentences } from "@/lib/engine/text";
import { applyFix, breaksIntent, score, verifyAiFindings } from "@/lib/engine/verify";
import { DEMO_KIT as kit } from "@/lib/db/seed";
import type { LlmProvider } from "@/lib/ai/gemini";

const TODAY = new Date("2026-11-05T12:00:00");
const CAPTION = "This Diwali, get the fastest delivery in India with Quick-Kart! Over 2 lakh happy customers trust us. Shop now, guys!!!";

describe("text utilities", () => {
  it("keeps sentence offsets into the original text", () => {
    const s = sentences("One. Two words here! Three?");
    expect(s.map((x) => x.text)).toEqual(["One.", "Two words here!", "Three?"]);
    expect("One. Two words here! Three?".slice(s[1].start, s[1].end)).toBe("Two words here!");
  });

  it("does not split sentences at a decimal point", () => {
    expect(sentences("Rated 4.6 stars. Great.").map((x) => x.text)).toEqual(["Rated 4.6 stars.", "Great."]);
    expect(extractClaims("QuickKart is rated 4.6 stars.", kit)).toHaveLength(1);
  });

  it("reads Indian and western number units", () => {
    expect(numbers("2 lakh users").map((n) => n.value)).toEqual([200000]);
    expect(numbers("3.1 crore and 50%")[0].value).toBe(31000000);
    expect(numbers("50%")[0].percent).toBe(true);
  });

  it("finds quotes tolerantly but refuses invented ones", () => {
    expect(findSpan("Shop  now, guys", "shop now, guys")).toEqual({ start: 0, end: 15 });
    expect(findSpan("Shop now", "Buy today")).toBeNull();
  });

  it("masks personal data and maps offsets back", () => {
    const text = "Mail me at aanya@example.com or call 9876543210 today";
    const r = redact(text);
    expect(r.text).not.toContain("aanya@example.com");
    expect(r.text).not.toContain("9876543210");
    expect(r.count).toBe(2);
    const at = r.text.indexOf("today");
    expect(text.slice(r.toOriginal(at), r.toOriginal(at) + 5)).toBe("today");
  });
});

describe("pass 1 · rules", () => {
  it("flags banned terminology with the preferred form as the fix", () => {
    const f = checkTerms(CAPTION, kit);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ quote: "Quick-Kart", fix: "QuickKart", cites: { kind: "term", id: "T-1" } });
  });

  it("runs pattern and sentence-length rules, and every finding cites a rule", () => {
    const f = checkTextRules(CAPTION, kit);
    const ids = f.map((x) => x.cites.id);
    expect(ids).toContain("R-1.3"); // guys
    expect(ids).toContain("R-1.4"); // !!!
    expect(f.every((x) => kit.rules.some((r) => r.id === x.cites.id))).toBe(true);
  });

  it("ignores a broken regex in the kit instead of crashing", () => {
    const bad = { ...kit, rules: [{ ...kit.rules[1], check: { kind: "pattern" as const, pattern: "([" } }] };
    expect(() => checkTextRules("anything", bad)).not.toThrow();
  });

  it("checks image alt text, contrast and palette", () => {
    const f = checkImage({ name: "b.png", altText: "", colors: ["#FFD54A", "#FF9A1F"] }, kit);
    expect(f.map((x) => x.cites.id).sort()).toEqual(["R-5.1", "R-5.2", "R-6.1"]);
    expect(contrast(hexToRgb("#000000")!, hexToRgb("#FFFFFF")!)).toBeCloseTo(21, 0);
  });
});

describe("pass 2 · claims (Fig. 13b decision tree)", () => {
  it("superlatives with no approved fact are unsupported blockers", () => {
    const { findings } = checkClaims(CAPTION, kit, TODAY);
    const sup = findings.find((f) => f.quote.startsWith("fastest"));
    expect(sup).toMatchObject({ severity: "blocker", claimStatus: "unsupported", needsReview: true });
    expect(sup?.fix).toBe("fast delivery across 40+ cities");
  });

  it("numbers that disagree with the register are contradicted, with the approved value as the fix", () => {
    const { findings } = checkClaims(CAPTION, kit, TODAY);
    const c = findings.find((f) => f.claimStatus === "contradicted");
    expect(c).toMatchObject({ quote: "2 lakh", fix: "3.1 lakh", cites: { kind: "fact", id: "F2" } });
  });

  it("expired facts make a claim outdated", () => {
    const { claims } = checkClaims("QuickKart is rated 4.6 stars.", kit, TODAY);
    expect(claims[0].status).toBe("outdated");
  });

  it("matching, unexpired facts are supported and produce no finding", () => {
    const { findings, claims } = checkClaims("Free delivery on orders above ₹199.", kit, TODAY);
    expect(claims[0].status).toBe("supported");
    expect(findings).toHaveLength(0);
  });

  it("never lets a claim span swallow the brand name, and trims dangling words", () => {
    const c = extractClaims("Fastest delivery from Quick Kart for you.", kit);
    expect(c[0].quote).toBe("Fastest delivery");
  });

  it("only suggests a fact as the fix when the claim names that fact's topic", () => {
    const { findings } = checkClaims("Best sweets in town for 3.1 lakh customers.", kit, TODAY);
    const best = findings.find((f) => f.quote.toLowerCase().startsWith("best"));
    expect(best?.fix).toBeNull(); // "customers" is elsewhere in the sentence, not in the claim
  });

  it("does not treat years as claims", () => {
    expect(extractClaims("Our Diwali 2026 range is here.")).toHaveLength(0);
  });

  it("formats values the way an Indian brand writes them", () => {
    expect(formatValue(310000)).toBe("3.1 lakh");
    expect(formatValue(25000000)).toBe("2.5 crore");
  });
});

describe("verifier", () => {
  const text = "Hurry, last chance to grab sweets before they are gone forever.";
  const r = redact(text);

  it("keeps findings whose quote and rule exist", () => {
    const { kept, dropped } = verifyAiFindings(
      [{ quote: "Hurry, last chance", ruleId: "R-2.3", message: "False urgency", fix: "Order today", confidence: 0.9 }],
      text, r, kit, []
    );
    expect(dropped).toBe(0);
    expect(kept[0]).toMatchObject({ start: 0, end: 18, ai: true, needsReview: false });
  });

  it("drops invented quotes, unknown rules and deterministic rule ids", () => {
    const { kept, dropped } = verifyAiFindings(
      [
        { quote: "this text is not in the draft", ruleId: "R-2.3", message: "x" },
        { quote: "Hurry", ruleId: "R-99", message: "x" },
        { quote: "Hurry", ruleId: "R-1.4", message: "x" }, // has a deterministic check, AI may not cite it
        { quote: "Hurry", ruleId: "R-2.3" }, // no message
      ],
      text, r, kit, []
    );
    expect(kept).toHaveLength(0);
    expect(dropped).toBe(4);
  });

  it("labels low-confidence findings for human review", () => {
    const { kept } = verifyAiFindings([{ quote: "gone forever", ruleId: "R-2.3", message: "Pressure", confidence: 0.3 }], text, r, kit, []);
    expect(kept[0].needsReview).toBe(true);
  });
});

describe("intent lock and score", () => {
  it("detects a fix that removes the key message", () => {
    const t = "Diwali delivery offer for everyone";
    expect(breaksIntent(t, { start: 0, end: 21, fix: "Great deals" }, "Diwali delivery offer")).toBe(true);
    expect(breaksIntent(t, { start: 22, end: 34, fix: "all" }, "Diwali delivery offer")).toBe(false);
  });

  it("applies a fix by span", () => {
    expect(applyFix("Quick-Kart rocks", { start: 0, end: 10, fix: "QuickKart" })).toBe("QuickKart rocks");
  });

  it("scores only open findings", () => {
    expect(score([{ severity: "blocker", status: "open" }, { severity: "warning", status: "accepted" }])).toBe(82);
  });
});

describe("runReview", () => {
  it("works with no AI provider and says so", async () => {
    const res = await runReview({ text: CAPTION, kit, today: TODAY });
    expect(res.ai.provider).toBeNull();
    expect(res.ai.note).toMatch(/AI pass off/);
    expect(res.findings.length).toBeGreaterThanOrEqual(5);
    // 1 blocker (18) + 2 warnings (7 each) + 2 suggestions (2 each) = 36 off
    expect(res.score).toBe(64);
  });

  it("runs the AI pass through the verifier and fences the draft as data", async () => {
    let prompt = "";
    const fake: LlmProvider = {
      name: "fake",
      async json<T>(_s: string, parts: { text?: string }[]) {
        prompt = parts[0].text ?? "";
        return {
          findings: [
            { quote: "Shop now", ruleId: "R-1.1", message: "Pushy", fix: "Order today", confidence: 0.8 },
            { quote: "made up", ruleId: "R-1.1", message: "x" },
          ],
        } as T;
      },
    };
    const res = await runReview({ text: CAPTION, kit, provider: fake, today: TODAY });
    expect(prompt).toContain("<draft>");
    expect(res.findings.some((f) => f.ai && f.quote === "Shop now")).toBe(true);
    expect(res.dropped).toBe(1);
    expect(res.ai.provider).toBe("fake");
  });

  it("falls back to deterministic checks when the AI call fails", async () => {
    const broken: LlmProvider = {
      name: "broken",
      json: async () => {
        throw new Error("quota");
      },
    };
    const res = await runReview({ text: CAPTION, kit, provider: broken, today: TODAY });
    expect(res.ai.provider).toBeNull();
    expect(res.ai.note).toMatch(/AI pass failed/);
    expect(res.findings.length).toBeGreaterThan(0);
  });
});

describe("score", () => {
  const hit = (id: string, severity: "blocker" | "warning") => ({ severity, status: "open" as const, cites: { id } });

  it("counts a rule broken in two places once, at its worst severity", () => {
    expect(score([hit("R-4.2", "blocker"), hit("R-4.2", "warning")])).toBe(82);
  });

  it("still counts different rules separately", () => {
    expect(score([hit("R-4.2", "blocker"), hit("R-1.4", "warning")])).toBe(75);
  });
});
