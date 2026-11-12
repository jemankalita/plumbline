import { describe, expect, it } from "vitest";
import { mergeImageEchoes } from "../src/lib/engine/echo";
import type { Finding, Severity } from "../src/lib/types";

function finding(id: string, citeId: string, quote: string, start: number, severity: Severity = "warning"): Finding {
  return {
    id,
    pass: start < 0 ? "image" : "rules",
    type: "terminology",
    severity,
    start,
    end: start < 0 ? -1 : start + quote.length,
    quote: start < 0 ? `Text on the image: “${quote}”` : quote,
    message: "Use the brand name as written.",
    cites: { kind: "term", id: citeId, label: "Term", excerpt: "QuickKart" },
    confidence: 1,
    needsReview: false,
    ai: start < 0,
    status: "open",
  };
}

describe("mergeImageEchoes", () => {
  it("shows a problem found in both the caption and the image as one finding", () => {
    // Arrange
    const caption = finding("a", "T-1", "Quick-Kart", 10);
    const onImage = finding("b", "T-1", "Quick-Kart", -1);

    // Act
    const merged = mergeImageEchoes([caption, onImage]);

    // Assert
    expect(merged.map((f) => f.id)).toEqual(["a"]);
    expect(merged[0].message).toContain("on the image");
  });

  it("matches words regardless of case and punctuation", () => {
    const merged = mergeImageEchoes([finding("a", "R-4.2", "fastest delivery in India", 0), finding("b", "R-4.2", "FASTEST DELIVERY IN INDIA", -1)]);
    expect(merged).toHaveLength(1);
  });

  it("keeps the more serious severity of the two", () => {
    const merged = mergeImageEchoes([finding("a", "F2", "2 lakh", 0, "warning"), finding("b", "F2", "2 lakh", -1, "blocker")]);
    expect(merged[0].severity).toBe("blocker");
  });

  it("keeps an image problem that is not in the caption", () => {
    const merged = mergeImageEchoes([finding("a", "T-1", "Quick-Kart", 10), finding("b", "R-4.5", "guaranteed", -1)]);
    expect(merged.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("keeps both when the same rule is broken by different words", () => {
    const merged = mergeImageEchoes([finding("a", "R-4.2", "fastest delivery in India", 0), finding("b", "R-4.2", "100% guaranteed", -1)]);
    expect(merged).toHaveLength(2);
  });

  it("leaves the input untouched", () => {
    const caption = finding("a", "T-1", "Quick-Kart", 10);
    const before = caption.message;
    mergeImageEchoes([caption, finding("b", "T-1", "Quick-Kart", -1)]);
    expect(caption.message).toBe(before);
  });
});
