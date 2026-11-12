// Pass 2 — claims. Extract every factual or superlative claim and check it against
// the organisation's approved-facts register. Claims default to UNSUPPORTED (Fig. 13b).

import type { BrandKit, ClaimResult, Fact, Finding, Rule } from "../types";
import { superlativeSpans } from "./rules";
import { numbers, sentences, tokens, uid } from "./text";

export interface Claim {
  start: number;
  end: number;
  quote: string;
  sentence: string;
  kind: "number" | "superlative";
  value?: number;
  percent?: boolean;
  phrase?: string;
  /** The word straight after a number, such as "minutes". */
  unit?: string;
  /** The currency written before a number, such as "inr". */
  currency?: string;
}

const CURRENCY_NAMES: Record<string, string> = { "₹": "inr", rs: "inr", "rs.": "inr", inr: "inr", $: "usd", usd: "usd", "€": "eur", eur: "eur", "£": "gbp", gbp: "gbp" };
const CURRENCY = "₹|rs\\.?|inr|\\$|usd|€|eur|£|gbp";
const CURRENCY_BEFORE = new RegExp(`(?<!\\p{L})(${CURRENCY})\\s*$`, "iu");
const CURRENCY_ON_NUMBER = new RegExp(`(?<!\\p{L})(${CURRENCY})\\s*\\d`, "iu");
const UNIT_AFTER = /^[ \t]*(\p{L}+)/u;

/** A fact can only back a number measured in the same thing. These words name what a number measures. */
const MEASURES = [
  ["minute", "minutes", "min", "mins"],
  ["hour", "hours", "hr", "hrs"],
  ["second", "seconds", "sec", "secs"],
  ["day", "days"],
  ["week", "weeks"],
  ["month", "months"],
  ["year", "years", "yr", "yrs"],
  ["km", "kms", "kilometre", "kilometres"],
  ["kg", "kgs"],
  ["country", "countries"],
  ["state", "states"],
  ["store", "stores"],
  ["app", "apps"],
];

const currencyName = (symbol?: string) => (symbol ? CURRENCY_NAMES[symbol.toLowerCase()] : undefined);

const TRAILING = new Set("from in with at by for to of the a an and or on our your".split(" "));

/**
 * Extend a span forward by up to `n` words, stopping at punctuation and at brand words
 * (so a claim never swallows the brand name), then trim dangling function words.
 */
function extend(text: string, end: number, n: number, stop: Set<string>): number {
  const re = /^[ \t]+([\p{L}\p{M}\p{N}'’-]+)/u;
  let cursor = end;
  const ends: { at: number; word: string }[] = [];
  for (let i = 0; i < n; i++) {
    const m = re.exec(text.slice(cursor));
    if (!m || stop.has(m[1].toLowerCase())) break;
    cursor += m[0].length;
    ends.push({ at: cursor, word: m[1].toLowerCase() });
  }
  while (ends.length && TRAILING.has(ends[ends.length - 1].word)) ends.pop();
  return ends.length ? ends[ends.length - 1].at : end;
}

function isYear(v: number, raw: string): boolean {
  return /^\d{4}$/.test(raw) && v >= 1900 && v <= 2100;
}

const MONTH = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const LABEL_BEFORE = new RegExp(`(?:\\b(?:step|version|page|section|chapter|phase|part|no\\.?|v)\\s*|\\b(?:${MONTH})\\s+)$`, "i");
const DATE_OR_TIME_AFTER = new RegExp(`^(?:\\s*(?:[–-]\\s*\\d{1,2}\\s+)?(?:${MONTH})\\b|\\s*(?:am|pm)\\b|:\\d{2})`, "i");

/** Numbers in dates, times and labels like "step 2" say nothing that needs proving. */
function isIncidental(sentence: string, start: number, end: number): boolean {
  return LABEL_BEFORE.test(sentence.slice(0, start)) || DATE_OR_TIME_AFTER.test(sentence.slice(end));
}

/** First words of capitalised brand names, preferred or banned: "quickkart", "quick", "qk"… */
function brandWords(kit?: BrandKit): Set<string> {
  const out = new Set<string>();
  for (const t of kit?.terms ?? []) {
    for (const w of [t.preferred, ...t.banned]) {
      const first = w.split(/[\s-]+/)[0];
      if (/^\p{Lu}/u.test(first)) out.add(first.toLowerCase()); // "delivery partner" is not a brand name
    }
  }
  return out;
}

export function extractClaims(text: string, kit?: BrandKit): Claim[] {
  const out: Claim[] = [];
  const stop = brandWords(kit);
  for (const s of sentences(text)) {
    const local = text.slice(s.start, s.end);
    for (const n of numbers(local)) {
      if (isYear(n.value, n.raw) || isIncidental(local, n.start, n.end)) continue;
      const start = s.start + n.start;
      const end = extend(text, s.start + n.end, n.percent ? 1 : 2, stop);
      const unit = UNIT_AFTER.exec(local.slice(n.end))?.[1].toLowerCase();
      const currency = currencyName(CURRENCY_BEFORE.exec(local.slice(0, n.start))?.[1]);
      out.push({ start, end, quote: text.slice(start, end), sentence: s.text, kind: "number", value: n.value, percent: n.percent, unit, currency });
    }
    for (const sp of superlativeSpans(local)) {
      const start = s.start + sp.start;
      const end = extend(text, s.start + sp.end, 3, stop);
      out.push({ start, end, quote: text.slice(start, end), sentence: s.text, kind: "superlative", phrase: sp.phrase });
    }
  }
  // drop claims fully inside another claim
  return out.filter((c, i) => !out.some((o, j) => j !== i && o.start <= c.start && o.end >= c.end && o.end - o.start > c.end - c.start));
}

function factTokens(f: Fact): Set<string> {
  return new Set([...f.keywords.flatMap(tokens), ...tokens(f.statement)]);
}

/**
 * Retrieve the best-matching approved fact by keyword overlap. Matches on the claim's own
 * words first; falls back to the sentence only when the claim itself names no topic.
 */
export function matchFact(claim: Claim, facts: Fact[]): { fact: Fact; score: number } | null {
  return matchOn(new Set(tokens(claim.quote)), facts) ?? matchOn(new Set(tokens(claim.sentence)), facts);
}

/** A topic match is not enough: the claim and the fact must be counting the same kind of thing. */
function isComparable(claim: Claim, fact: Fact): boolean {
  if (claim.percent && !fact.statement.includes("%")) return false;
  if (claim.currency && claim.currency !== currencyName(CURRENCY_ON_NUMBER.exec(fact.statement)?.[1])) return false;
  const measure = claim.unit ? MEASURES.find((group) => group.includes(claim.unit as string)) : undefined;
  if (!measure) return true;
  const words = factTokens(fact);
  return measure.some((word) => words.has(word));
}

function matchOn(words: Set<string>, facts: Fact[]): { fact: Fact; score: number } | null {
  let best: { fact: Fact; score: number } | null = null;
  for (const fact of facts) {
    const keys = fact.keywords.flatMap(tokens);
    const keyHits = keys.filter((k) => words.has(k)).length;
    if (keyHits === 0) continue;
    const overlap = [...factTokens(fact)].filter((t) => words.has(t)).length;
    const score = keyHits * 2 + overlap;
    if (!best || score > best.score) best = { fact, score };
  }
  return best;
}

export function isExpired(fact: Fact, today: Date): boolean {
  if (!fact.expiresOn) return false;
  const d = new Date(fact.expiresOn + "T23:59:59");
  return !Number.isNaN(d.getTime()) && d < today;
}

/** Format a number the way an Indian brand writes it: 310000 → "3.1 lakh". */
export function formatValue(v: number): string {
  const trim = (n: number) => String(Math.round(n * 10) / 10);
  if (v >= 1e7) return `${trim(v / 1e7)} crore`;
  if (v >= 1e5) return `${trim(v / 1e5)} lakh`;
  return v.toLocaleString("en-IN");
}

function agrees(claimValue: number, factValue: number): boolean {
  if (factValue === 0) return claimValue === 0;
  return Math.abs(claimValue - factValue) / Math.abs(factValue) <= 0.05;
}

export interface ClaimsOutput {
  findings: Finding[];
  claims: ClaimResult[];
}

export function checkClaims(text: string, kit: BrandKit, today = new Date()): ClaimsOutput {
  const claimRule: Rule | undefined = kit.rules.find((r) => r.check?.kind === "superlative");
  const findings: Finding[] = [];
  const claims: ClaimResult[] = [];

  for (const c of extractClaims(text, kit)) {
    const hit = matchFact(c, kit.facts);
    const isMismatch = hit !== null && !isComparable(c, hit.fact);
    const fact = isMismatch ? undefined : hit?.fact;
    // A superlative is supported only by a fact that names that exact superlative as a keyword.
    const supportsSuperlative =
      c.kind === "superlative" && fact && c.phrase
        ? fact.keywords.some((k) => k.trim().toLowerCase() === c.phrase!.toLowerCase())
        : false;

    let status: ClaimResult["status"];
    if (!fact || (c.kind === "superlative" && !supportsSuperlative)) status = "unsupported";
    else if (isExpired(fact, today)) status = "outdated";
    else if (c.kind === "number" && fact.value != null && c.value != null && !agrees(c.value, fact.value)) status = "contradicted";
    else if (c.kind === "number" && fact.value == null) status = "unsupported";
    else status = "supported";

    claims.push({ quote: c.quote, start: c.start, end: c.end, status, factId: status === "unsupported" ? null : fact?.id ?? null });
    if (status === "supported") continue;

    const common = {
      id: uid(),
      pass: "claims" as const,
      type: "claim" as const,
      start: c.start,
      end: c.end,
      quote: c.quote,
      confidence: 1,
      ai: false,
      status: "open" as const,
      claimStatus: status,
    };

    if (status === "unsupported") {
      if (!claimRule) continue; // nothing in the kit to cite, so no finding (verifier rule)
      findings.push({
        ...common,
        severity: c.kind === "superlative" ? "blocker" : "warning",
        message:
          c.kind === "superlative"
            ? `“${c.quote}” is a superlative with no approved fact behind it.`
            : `No approved fact backs “${c.quote}”. Route to a reviewer or add it to the facts register.`,
        cites: { kind: "rule", id: claimRule.id, label: `Rule ${claimRule.section}`, excerpt: claimRule.text },
        // only offer a replacement when the claim itself names the fact's topic
        fix: isMismatch ? null : matchOn(new Set(tokens(c.quote)), kit.facts)?.fact.statement ?? null,
        needsReview: true,
      });
    } else if (status === "outdated" && fact) {
      findings.push({
        ...common,
        severity: "warning",
        message: `The approved fact expired on ${fact.expiresOn}. Check with ${fact.owner} before publishing.`,
        cites: { kind: "fact", id: fact.id, label: `Fact ${fact.id}`, excerpt: `${fact.statement} — ${fact.source}` },
        fix: null,
        needsReview: true,
      });
    } else if (status === "contradicted" && fact && fact.value != null) {
      const num = numbers(c.quote)[0];
      const quoteEnd = num ? c.start + num.end : c.end;
      findings.push({
        ...common,
        end: quoteEnd,
        quote: text.slice(c.start, quoteEnd),
        severity: "warning",
        message: `The facts register says ${formatValue(fact.value)} (${fact.source}).`,
        cites: { kind: "fact", id: fact.id, label: `Fact ${fact.id}`, excerpt: `${fact.statement} — ${fact.source}` },
        fix: formatValue(fact.value),
        needsReview: false,
      });
    }
  }
  return { findings, claims };
}
