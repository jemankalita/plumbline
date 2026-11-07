import { beforeEach, describe, expect, it } from "vitest";
import type { LlmProvider } from "@/lib/ai/gemini";
import { DEMO_KIT as kit } from "@/lib/db/seed";
import { runReview } from "@/lib/engine";
import { clearVisionCache, imageTextFindings, verifyVision } from "@/lib/engine/vision";
import type { ImageInput } from "@/lib/types";

const TODAY = new Date("2026-11-05T12:00:00");
const IMAGE: ImageInput = { name: "post.jpg", altText: "", colors: ["#0B8F5A", "#FFFFFF"], thumbnail: "data:image/jpeg;base64,AAAA" };
const visionRules = kit.rules.filter((r) => r.check?.kind === "vision");
const MOOD = visionRules[0];

beforeEach(clearVisionCache);

const replying = (reply: object): LlmProvider => ({ name: "fake", json: async <T,>() => reply as T });

describe("image rules in the demo kit", () => {
  it("has rules that only the image pass judges", () => {
    expect(visionRules.length).toBeGreaterThanOrEqual(3);
  });
});

describe("verifyVision", () => {
  it("turns a failed check into an AI finding that cites the rule", () => {
    const { findings, report } = verifyVision(
      { description: "A dark car park", visibleText: "", checks: [{ ruleId: MOOD.id, pass: false, note: "Very dark and blurred", confidence: 0.9 }] },
      kit
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ ai: true, pass: "image", start: -1, status: "open" });
    expect(findings[0].cites.id).toBe(MOOD.id);
    expect(report.checks[0]).toMatchObject({ ruleId: MOOD.id, pass: false });
  });

  it("keeps a passed check in the report without raising a finding", () => {
    const { findings, report } = verifyVision({ checks: [{ ruleId: MOOD.id, pass: true, note: "Bright daylight", confidence: 0.9 }] }, kit);
    expect(findings).toHaveLength(0);
    expect(report.checks[0].pass).toBe(true);
  });

  it("drops a check that cites a rule the kit does not have", () => {
    const { findings, dropped } = verifyVision({ checks: [{ ruleId: "R-INVENTED", pass: false, note: "Made up", confidence: 1 }] }, kit);
    expect(findings).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("drops a check that cites a text rule instead of an image rule", () => {
    const { dropped } = verifyVision({ checks: [{ ruleId: "R-1.1", pass: false, note: "Pushy", confidence: 1 }] }, kit);
    expect(dropped).toBe(1);
  });

  it("drops a failed check that gives no reason", () => {
    const { findings, dropped } = verifyVision({ checks: [{ ruleId: MOOD.id, pass: false, note: "  ", confidence: 1 }] }, kit);
    expect(findings).toHaveLength(0);
    expect(dropped).toBe(1);
  });

  it("counts a repeated rule once", () => {
    const check = { ruleId: MOOD.id, pass: false, note: "Dark", confidence: 0.9 };
    const { findings, dropped } = verifyVision({ checks: [check, check] }, kit);
    expect(findings).toHaveLength(1);
    expect(dropped).toBe(1);
  });

  it("routes a low-confidence judgement to a reviewer", () => {
    const { findings } = verifyVision({ checks: [{ ruleId: MOOD.id, pass: false, note: "Maybe dark", confidence: 0.3 }] }, kit);
    expect(findings[0].needsReview).toBe(true);
  });

  it("never lets an AI opinion about an image block on its own", () => {
    const strict = { ...kit, rules: kit.rules.map((r) => (r.id === MOOD.id ? { ...r, severity: "blocker" as const } : r)) };
    const { findings } = verifyVision({ checks: [{ ruleId: MOOD.id, pass: false, note: "Dark", confidence: 0.99 }] }, strict);
    expect(findings[0].severity).toBe("warning");
    expect(findings[0].needsReview).toBe(true);
  });

  it("survives a reply that is not the expected shape", () => {
    expect(verifyVision({ checks: "nope" } as never, kit).findings).toEqual([]);
    expect(verifyVision(null as never, kit).report.description).toBe("");
  });
});

describe("imageTextFindings", () => {
  it("checks words read off the image with the same rules as text", () => {
    const found = imageTextFindings("Quick-Kart: fastest delivery in India", kit, TODAY);
    expect(found.map((f) => f.cites.id)).toEqual(expect.arrayContaining(["T-1", "R-4.2"]));
    expect(found.every((f) => f.start === -1 && f.pass === "image" && f.ai)).toBe(true);
  });

  it("does not apply body-copy readability rules to a headline on an image", () => {
    expect(imageTextFindings("FRESH GROCERIES DAILY", kit, TODAY)).toEqual([]);
  });

  it("returns nothing when the image has no text", () => {
    expect(imageTextFindings("", kit, TODAY)).toEqual([]);
  });
});

describe("runReview with an image", () => {
  const reply = {
    description: "Carrots on a table",
    visibleText: "Quick-Kart",
    alt: "Carrots on a table with the words Quick-Kart",
    checks: [{ ruleId: MOOD.id, pass: false, note: "Too dark", confidence: 0.9 }],
    findings: [],
  };

  it("reports what the AI saw and records the call", async () => {
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying(reply), today: TODAY });
    expect(res.imageReport?.description).toBe("Carrots on a table");
    expect(res.imageReport?.visibleText).toBe("Quick-Kart");
    expect(res.ai.calls.find((c) => c.pass === "image")).toMatchObject({ status: "ran", model: "fake" });
    expect(res.ai.passes).toContain("image");
  });

  it("offers the AI alt text as a fix", async () => {
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying(reply), today: TODAY });
    const alt = res.findings.find((f) => f.cites.id === "R-5.1");
    expect(alt).toMatchObject({ fix: reply.alt, altFix: true, ai: true });
  });

  it("calls the image off brand when two or more things fail", async () => {
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying(reply), today: TODAY });
    expect(res.imageReport?.verdict).toBe("off");
  });

  it("calls the image aligned when every check passes and its text is clean", async () => {
    const clean = { description: "Bright", visibleText: "QuickKart", checks: visionRules.map((r) => ({ ruleId: r.id, pass: true, note: "Fine", confidence: 0.9 })) };
    const res = await runReview({ text: "", kit, image: { ...IMAGE, altText: "Bright food" }, provider: replying(clean), today: TODAY });
    expect(res.imageReport?.verdict).toBe("aligned");
  });

  it("skips the image pass and says why when AI is off", async () => {
    const res = await runReview({ text: "", kit, image: IMAGE, today: TODAY });
    expect(res.imageReport).toBeNull();
    expect(res.ai.calls.find((c) => c.pass === "image")).toMatchObject({ status: "skipped" });
    expect(res.findings.length).toBeGreaterThan(0); // alt text is still checked by plain code
  });

  it("skips the image pass when the image has no thumbnail to send", async () => {
    const res = await runReview({ text: "", kit, image: { ...IMAGE, thumbnail: null }, provider: replying(reply), today: TODAY });
    expect(res.ai.calls.find((c) => c.pass === "image")).toMatchObject({ status: "skipped" });
  });

  it("reports a failed image call without losing the plain-code checks", async () => {
    const broken: LlmProvider = {
      name: "fake",
      json: async () => {
        throw new Error("Gemini 503");
      },
    };
    const res = await runReview({ text: "", kit, image: IMAGE, provider: broken, today: TODAY });
    expect(res.ai.calls.find((c) => c.pass === "image")).toMatchObject({ status: "failed" });
    expect(res.findings.some((f) => f.cites.id === "R-5.1")).toBe(true);
  });

  it("does not call the text pass when there is no text", async () => {
    let calls = 0;
    const counting: LlmProvider = {
      name: "fake",
      json: async <T,>() => {
        calls++;
        return reply as T;
      },
    };
    const res = await runReview({ text: "", kit, image: IMAGE, provider: counting, today: TODAY });
    expect(calls).toBe(1);
    expect(res.ai.calls.find((c) => c.pass === "judgement")).toMatchObject({ status: "skipped" });
  });
});

describe("keeping image findings honest and short", () => {
  const banner = (note: string) => ({
    description: "A banner",
    visibleText: "100% guaranteed this Diwali Quick-Kart Over 2 lakh customers!!!",
    alt: "A banner",
    checks: [{ ruleId: "R-6.4", pass: false, note, confidence: 0.9 }],
  });

  it("does not compare a percentage with a customer count", () => {
    const found = imageTextFindings("100% guaranteed this Diwali Over 2 lakh customers", kit, TODAY);
    expect(found.some((f) => f.quote.includes("100%") && f.fix === "3.1 lakh")).toBe(false);
    expect(found.some((f) => f.quote.includes("2 lakh") && f.fix === "3.1 lakh")).toBe(true);
  });

  it("leaves punctuation style out of image text", () => {
    expect(imageTextFindings("Big savings!!!", kit, TODAY).filter((f) => f.severity === "suggestion")).toHaveLength(0);
  });

  it("reports a wrong name on the image once", async () => {
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying(banner("Written as 'Quick-Kart' with a hyphen.")), today: TODAY });
    expect(res.findings.filter((f) => f.pass === "image" && (f.cites.id === "R-6.4" || f.quote.includes("Quick-Kart")))).toHaveLength(1);
    expect(res.imageReport?.checks.find((c) => c.ruleId === "R-6.4")?.pass).toBe(false);
  });

  it("lets AI judge readable words instead of the two-colour estimate", async () => {
    const dark: ImageInput = { ...IMAGE, colors: ["#0B070B", "#282826"] };
    const contrast = kit.rules.find((r) => r.check?.kind === "contrast")!.id;
    const withAi = await runReview({ text: "", kit, image: dark, provider: replying({ description: "x", visibleText: "", checks: [{ ruleId: "R-6.6", pass: true, note: "No words", confidence: 1 }] }), today: TODAY });
    const withoutAi = await runReview({ text: "", kit, image: dark, today: TODAY });
    expect(withAi.findings.some((f) => f.cites.id === contrast)).toBe(false);
    expect(withoutAi.findings.some((f) => f.cites.id === contrast)).toBe(true);
  });

  it("marks the missing alt text finding even when AI wrote no fix", async () => {
    const res = await runReview({ text: "", kit, image: IMAGE, today: TODAY });
    expect(res.findings.find((f) => f.alt)).toMatchObject({ fix: null, start: -1 });
  });
});

describe("when AI gives no real verdict", () => {
  it("reports a failed check instead of a pass when no verdicts come back", async () => {
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying({}), today: TODAY });
    expect(res.imageReport).toBeNull();
    expect(res.ai.calls.find((c) => c.pass === "image")).toMatchObject({ status: "failed" });
  });

  it("does not call an image aligned when rules were skipped", async () => {
    const reply = { description: "x", visibleText: "", checks: [{ ruleId: MOOD.id, pass: true, note: "Bright", confidence: 1 }] };
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying(reply), today: TODAY });
    expect(res.imageReport?.verdict).not.toBe("aligned");
  });
});

describe("repeat checks and readable words", () => {
  const allPass = visionRules.map((r) => ({ ruleId: r.id, pass: true, note: "Fine", confidence: 0.9 }));

  it("gives the same verdict for the same image without a second AI call", async () => {
    let calls = 0;
    const counting: LlmProvider = {
      name: "fake",
      json: async <T,>() => {
        calls++;
        return { description: "x", visibleText: "", checks: allPass } as T;
      },
    };
    const first = await runReview({ text: "", kit, image: IMAGE, provider: counting, today: TODAY });
    const second = await runReview({ text: "", kit, image: IMAGE, provider: counting, today: TODAY });
    expect(calls).toBe(1);
    expect(second.imageReport).toEqual(first.imageReport);
    expect(second.ai.calls.find((c) => c.pass === "image")?.returned).toMatch(/saved result/i);
  });

  it("fails the words rule by measurement when AI passed low-contrast words", async () => {
    const reply = { description: "x", visibleText: "SALE", checks: allPass, wordColors: [{ text: "SALE", fg: "#FFD23F", bg: "#FF9A1E" }] };
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying(reply), today: TODAY });
    expect(res.imageReport?.checks.find((c) => c.ruleId === "R-6.6")?.pass).toBe(false);
    expect(res.findings.find((f) => f.cites.id === "R-6.6")?.message).toMatch(/SALE.*: 1/);
  });

  it("leaves the words rule passed when the measured contrast is fine", async () => {
    const reply = { description: "x", visibleText: "SALE", checks: allPass, wordColors: [{ text: "SALE", fg: "#FFFFFF", bg: "#0B3D2E" }] };
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying(reply), today: TODAY });
    expect(res.imageReport?.checks.find((c) => c.ruleId === "R-6.6")?.pass).toBe(true);
  });

  it("ignores colours that are not real hex values", async () => {
    const reply = { description: "x", visibleText: "SALE", checks: allPass, wordColors: [{ text: "SALE", fg: "yellow", bg: "#FF9A1E" }] };
    const res = await runReview({ text: "", kit, image: IMAGE, provider: replying(reply), today: TODAY });
    expect(res.imageReport?.checks.find((c) => c.ruleId === "R-6.6")?.pass).toBe(true);
  });
});
