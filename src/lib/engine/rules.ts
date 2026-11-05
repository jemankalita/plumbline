// Pass 1 — deterministic checks. Exact, explainable, and always cite a Brand Kit record.

import type { BrandKit, Finding, ImageInput, Rule } from "../types";
import { contrast, hexToRgb, nearest, type RGB } from "./color";
import { escapeRegex, findAll, sentences, uid, wordCount } from "./text";

function ruleCite(rule: Rule) {
  return { kind: "rule" as const, id: rule.id, label: `Rule ${rule.section}`, excerpt: rule.text };
}

function base(rule: Rule, start: number, end: number, quote: string, message: string, fix: string | null = null): Finding {
  return {
    id: uid(),
    pass: "rules",
    type: rule.category,
    severity: rule.severity,
    start,
    end,
    quote,
    message,
    cites: ruleCite(rule),
    fix,
    confidence: 1,
    needsReview: false,
    ai: false,
    status: "open",
  };
}

/** Terminology: banned variants → preferred form. */
export function checkTerms(text: string, kit: BrandKit): Finding[] {
  const out: Finding[] = [];
  for (const term of kit.terms) {
    for (const variant of term.banned) {
      for (const span of findAll(text, variant)) {
        const quote = text.slice(span.start, span.end);
        if (quote === term.preferred) continue;
        out.push({
          id: uid(),
          pass: "rules",
          type: "terminology",
          severity: "warning",
          start: span.start,
          end: span.end,
          quote,
          message: `Write “${term.preferred}”, not “${quote}”.${term.note ? " " + term.note : ""}`,
          cites: {
            kind: "term",
            id: term.id,
            label: `Term · ${term.preferred}`,
            excerpt: `Preferred: ${term.preferred}. Not: ${term.banned.join(", ")}.`,
          },
          fix: term.preferred,
          confidence: 1,
          needsReview: false,
          ai: false,
          status: "open",
        });
      }
    }
  }
  return out;
}

/** Rules that carry a pattern or sentence-length check. */
export function checkTextRules(text: string, kit: BrandKit): Finding[] {
  const out: Finding[] = [];
  for (const rule of kit.rules) {
    const check = rule.check;
    if (!check) continue;
    if (check.kind === "pattern") {
      let re: RegExp;
      try {
        re = new RegExp(check.pattern, (check.flags ?? "gi").includes("g") ? check.flags ?? "gi" : (check.flags ?? "") + "g");
      } catch {
        continue; // a bad pattern in the kit must never crash a review
      }
      for (const m of text.matchAll(re)) {
        if (!m[0]) continue;
        const start = m.index ?? 0;
        out.push(base(rule, start, start + m[0].length, m[0], rule.title, check.fix ?? null));
      }
    }
    if (check.kind === "maxSentenceWords") {
      for (const s of sentences(text)) {
        const n = wordCount(s.text);
        if (n > check.value) {
          out.push(base(rule, s.start, s.end, s.text, `${n} words. ${rule.title}: aim for ${check.value} or fewer.`));
        }
      }
    }
  }
  return out;
}

const SUPERLATIVES = [
  "fastest",
  "cheapest",
  "best",
  "lowest price",
  "lowest prices",
  "number one",
  "no. 1",
  "#1",
  "india's favourite",
  "most trusted",
  "most loved",
  "100% safe",
  "100% natural",
  "unbeatable",
  "world-class",
  "leading",
];

/** Superlative phrases that need evidence. Returned as candidate claims for pass 2. */
export function superlativeSpans(text: string): { start: number; end: number; phrase: string }[] {
  const out: { start: number; end: number; phrase: string }[] = [];
  for (const p of SUPERLATIVES) {
    for (const span of findAll(text, p)) out.push({ ...span, phrase: text.slice(span.start, span.end) });
  }
  return out.sort((a, b) => a.start - b.start);
}

export const superlativePattern = new RegExp(SUPERLATIVES.map(escapeRegex).join("|"), "i");

/** Image checks: alt text, contrast between the two dominant colours, off-palette colours. */
export function checkImage(image: ImageInput | null | undefined, kit: BrandKit): Finding[] {
  if (!image) return [];
  const out: Finding[] = [];
  const imgFinding = (rule: Rule, message: string, fix: string | null = null): Finding => ({
    ...base(rule, -1, -1, image.name, message, fix),
    pass: "image",
  });
  const colors = image.colors.map(hexToRgb).filter((c): c is RGB => c !== null);
  const palette = kit.palette.map((p) => hexToRgb(p.hex)).filter((c): c is RGB => c !== null);

  for (const rule of kit.rules) {
    const check = rule.check;
    if (!check) continue;
    if (check.kind === "altText" && !(image.altText ?? "").trim()) {
      out.push(imgFinding(rule, "Image has no alt text, so screen-reader users get nothing."));
    }
    if (check.kind === "contrast" && colors.length >= 2) {
      const ratio = contrast(colors[0], colors[1]);
      if (ratio < check.min) {
        const dark = palette.slice().sort((a, b) => contrast(b, colors[0]) - contrast(a, colors[0]))[0];
        const better = dark ? contrast(dark, colors[0]) : null;
        out.push(
          imgFinding(
            rule,
            `Main colours ${image.colors[0]} / ${image.colors[1]} contrast at ${ratio.toFixed(1)} : 1 (needs ${check.min} : 1).`,
            dark && better ? `Use ${kit.palette[palette.indexOf(dark)].name} text (${better.toFixed(1)} : 1)` : null
          )
        );
      }
    }
    if (check.kind === "palette" && palette.length) {
      const off = colors
        .map((c, i) => ({ hex: image.colors[i], ...nearest(c, palette) }))
        .filter((c) => c.distance > check.maxDistance);
      if (off.length) {
        const n = off[0];
        out.push(
          imgFinding(
            rule,
            `${off.map((o) => o.hex).join(", ")} ${off.length > 1 ? "are" : "is"} not in the brand palette.`,
            `Closest brand colour: ${kit.palette[n.index].name} ${kit.palette[n.index].hex}`
          )
        );
      }
    }
  }
  return out;
}
