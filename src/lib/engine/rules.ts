// Pass 1 — deterministic checks. Exact, explainable, and always cite a Brand Kit record.

import type { BrandKit, Finding, ImageInput, Rule } from "../types";
import { altProblem } from "./alt";
import { contrast, hexToRgb, nearest, type RGB } from "./color";
import { judgeAreas } from "./palette";
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
        if (!m[0] || isAcceptedAcronym(m[0], text, kit)) continue;
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

/** A capitalised word the kit uses, or that the draft spells out in brackets, is an acronym rather than shouting. */
function isAcceptedAcronym(word: string, text: string, kit: BrandKit): boolean {
  if (!/^[A-Z]{2,}$/.test(word)) return false;
  const kitWords = kit.terms.flatMap((t) => t.preferred.split(/[^\p{L}]+/u));
  return kitWords.includes(word) || text.includes(`(${word})`);
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

// "best regards" and "leading to" use the words without claiming anything.
const NOT_A_CLAIM_AFTER = /^\s+(?:regards|wishes|practices?|to|up\s+to)\b/i;

/** Superlative phrases that need evidence. Returned as candidate claims for pass 2. */
export function superlativeSpans(text: string): { start: number; end: number; phrase: string }[] {
  const out: { start: number; end: number; phrase: string }[] = [];
  for (const p of SUPERLATIVES) {
    for (const span of findAll(text, p)) {
      if (!NOT_A_CLAIM_AFTER.test(text.slice(span.end, span.end + 16))) out.push({ ...span, phrase: text.slice(span.start, span.end) });
    }
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
    const altIssue = check.kind === "altText" ? altProblem(image.altText) : null;
    if (altIssue) out.push(imgFinding(rule, altIssue));
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
    if (check.kind === "palette" && palette.length && image.colorAreas) {
      const hexes = kit.palette.map((p) => p.hex);
      const { off, near } = judgeAreas(image.colorAreas, hexes);
      const worst = off[0] ?? near[0];
      if (worst) {
        const percent = (share: number) => `${Math.round(share * 100)}%`;
        const parts = [
          ...off.map((a) => `${a.hex} covers ${percent(a.share)} of the image and is not a brand colour.`),
          ...near.map((a) => `${a.hex} covers ${percent(a.share)} and is close to ${kit.palette[a.nearest].name}, but not the same.`),
        ];
        out.push(imgFinding(rule, parts.join(" "), `Closest brand colour: ${kit.palette[worst.nearest].name} ${kit.palette[worst.nearest].hex}`));
      }
    }
    if (check.kind === "palette" && palette.length && !image.colorAreas) {
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
