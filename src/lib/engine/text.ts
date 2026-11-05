// Text utilities used by every pass: spans, sentences, numbers, redaction.

export interface Span {
  start: number;
  end: number;
}

export interface Sentence extends Span {
  text: string;
}

/** Split into sentences, keeping character offsets into the original text. */
export function sentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  // A sentence ends at .!? followed by whitespace or the end, so "4.6" and "₹1.5" stay whole.
  const re = /[\s\S]+?(?:[.!?]+(?=\s|$)|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const start = m.index + lead;
    out.push({ start, end: start + trimmed.length, text: trimmed });
  }
  return out;
}

export function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Locate a quote inside text. Tries exact, then case-insensitive, then a
 * whitespace/quote-tolerant match. Returns null when the quote is not really there,
 * which is how the verifier catches invented spans.
 */
export function findSpan(text: string, quote: string, from = 0): Span | null {
  const q = quote.trim();
  if (q.length < 2) return null;
  const exact = text.indexOf(q, from);
  if (exact >= 0) return { start: exact, end: exact + q.length };
  const lower = text.toLowerCase().indexOf(q.toLowerCase(), from);
  if (lower >= 0) return { start: lower, end: lower + q.length };
  const quoteClass = "[\"'‘’“”]";
  const pattern = q
    .split(/\s+/)
    .map((w) => escapeRegex(w).replace(/["'‘’“”]/g, quoteClass))
    .join("\\s+");
  const m = new RegExp(pattern, "i").exec(text.slice(from));
  if (m) return { start: from + m.index, end: from + m.index + m[0].length };
  return null;
}

/** Every whole-word, case-insensitive occurrence of a phrase. */
export function findAll(text: string, phrase: string): Span[] {
  const p = phrase.trim();
  if (!p) return [];
  const startB = /^[\p{L}\p{N}]/u.test(p) ? "(?<![\\p{L}\\p{N}])" : "";
  const endB = /[\p{L}\p{N}]$/u.test(p) ? "(?![\\p{L}\\p{N}])" : "";
  const re = new RegExp(startB + escapeRegex(p) + endB, "giu");
  return [...text.matchAll(re)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
}

const UNIT: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  lakh: 1e5,
  lakhs: 1e5,
  lac: 1e5,
  crore: 1e7,
  crores: 1e7,
  cr: 1e7,
  million: 1e6,
  mn: 1e6,
  billion: 1e9,
  bn: 1e9,
};

export interface NumberMention extends Span {
  value: number;
  raw: string;
  percent: boolean;
}

/** Numbers with Indian and western multipliers: "3.1 lakh", "2,00,000", "40+", "50%". */
export function numbers(text: string): NumberMention[] {
  const re = /(\d[\d,]*(?:\.\d+)?)\s*(%|k\b|thousand|lakhs?|lac\b|crores?|cr\b|million|mn\b|billion|bn\b)?/gi;
  const out: NumberMention[] = [];
  for (const m of text.matchAll(re)) {
    const base = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isNaN(base)) continue;
    const unit = (m[2] ?? "").toLowerCase();
    const percent = unit === "%";
    const mult = percent ? 1 : UNIT[unit] ?? 1;
    const start = m.index ?? 0;
    out.push({ start, end: start + m[0].trimEnd().length, raw: m[0].trim(), value: base * mult, percent });
  }
  return out;
}

const STOP = new Set(
  "the a an and or of to in on for with our we you your is are be this that it as at by from get over up all now us".split(" ")
);

export function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((t) => t.length > 1 && !STOP.has(t));
}

export interface Redaction {
  text: string;
  /** Map an index in the redacted text back to the original text. */
  toOriginal: (i: number) => number;
  count: number;
}

const PII: { re: RegExp; label: string }[] = [
  { re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, label: "[EMAIL]" },
  { re: /(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, label: "[PHONE]" },
  { re: /\b\d{4}\s\d{4}\s\d{4}\b/g, label: "[ID]" },
];

/** Mask personal data before anything is sent to an AI provider. */
export function redact(text: string): Redaction {
  const hits: { start: number; end: number; label: string }[] = [];
  for (const { re, label } of PII) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!hits.some((h) => start < h.end && end > h.start)) hits.push({ start, end, label });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  let delta = 0;
  const marks: { at: number; delta: number }[] = [];
  for (const h of hits) {
    out += text.slice(cursor, h.start) + h.label;
    delta += h.end - h.start - h.label.length;
    marks.push({ at: out.length, delta });
    cursor = h.end;
  }
  out += text.slice(cursor);
  return {
    text: out,
    count: hits.length,
    toOriginal: (i: number) => {
      let d = 0;
      for (const mk of marks) if (i >= mk.at) d = mk.delta;
      return i + d;
    },
  };
}

let counter = 0;
export function uid(prefix = "f"): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
