// Tools for the AI reference labels. Every command prints totals only, never post text.
// Usage: node eval/scripts/labels.mjs <kit|disputes|finalise>

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const LABELS = join(ROOT, "labels");
const MODEL = "claude-sonnet-5-5 (Agent tool alias: sonnet)";
const ALPHA_FLOOR = 0.667;
const TERMS_GROUP = "terms";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const read = (...parts) => readFileSync(join(ROOT, ...parts), "utf8");
const readJsonl = (...parts) => read(...parts).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
const toJsonl = (rows) => rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
const kit = () => JSON.parse(read("kit", "govuk-style-kit.json"));
const posts = () => readJsonl("corpus", "posts.jsonl");

function citeIndex() {
  const k = kit();
  return new Map([...k.rules.map((r) => [r.id, `${r.title}: ${r.text}`]), ...k.terms.map((t) => [t.id, `Write "${t.preferred}", not: ${t.banned.join(", ")}.${t.note ? ` ${t.note}` : ""}`])]);
}

/** The kit as the labellers see it: wording only, with no patterns the engine uses. */
function writeLabellerKit() {
  const k = kit();
  const rules = k.rules.map((r) => `| ${r.id} | ${r.title} | ${r.text}${r.goodExample ? ` Good: "${r.goodExample}"` : ""}${r.badExample ? ` Bad: "${r.badExample}"` : ""} |`);
  const terms = k.terms.map((t) => `| ${t.id} | ${t.banned.join(", ")} | ${t.preferred} | ${t.note ?? ""} |`);
  const md = [`# Style kit`, ``, k.voice, ``, `## Rules`, ``, `| ID | Title | Rule |`, `|---|---|---|`, ...rules, ``, `## Word list`, ``, `| ID | Avoid | Use instead | Note |`, `|---|---|---|---|`, ...terms, ``].join("\n");
  writeFileSync(join(ROOT, "kit", "labeller-kit.md"), md);
  console.log(JSON.stringify({ rules: k.rules.length, terms: k.terms.length }));
}

/** Resolve each quote to a span, using a separate occurrence for each repeat. */
function resolve(file, byId, cites) {
  const problems = { missingPost: 0, badCite: 0, quoteNotFound: 0 };
  const out = new Map();
  for (const row of readJsonl("labels", file)) {
    const post = byId.get(row.postId);
    if (!post) {
      problems.missingPost += 1;
      continue;
    }
    const used = new Set();
    const spans = [];
    for (const label of row.labels) {
      if (!cites.has(label.citeId)) {
        problems.badCite += 1;
        continue;
      }
      let start = post.text.indexOf(label.quote);
      while (start >= 0 && used.has(`${label.citeId}:${start}`)) start = post.text.indexOf(label.quote, start + 1);
      if (start < 0) {
        problems.quoteNotFound += 1;
        continue;
      }
      used.add(`${label.citeId}:${start}`);
      spans.push({ ...label, start, end: start + label.quote.length });
    }
    out.set(row.postId, spans);
  }
  return { spans: out, problems };
}

const overlaps = (a, b) => a.citeId === b.citeId && a.start < b.end && b.start < a.end;

/** One-to-one pairing of the labellers' spans for one post. */
function pair(a, b) {
  const freeB = new Set(b);
  const agreed = [];
  const onlyA = [];
  for (const x of a) {
    const match = [...freeB].find((y) => overlaps(x, y));
    if (match) {
      freeB.delete(match);
      agreed.push(x);
    } else {
      onlyA.push(x);
    }
  }
  return { agreed, onlyA, onlyB: [...freeB] };
}

function loadBoth() {
  const all = posts();
  const byId = new Map(all.map((p) => [p.id, p]));
  const cites = citeIndex();
  const a = resolve("a.jsonl", byId, cites);
  const b = resolve("b.jsonl", byId, cites);
  if (a.spans.size !== all.length || b.spans.size !== all.length) throw new Error(`Labels cover ${a.spans.size} and ${b.spans.size} of ${all.length} posts.`);
  return { all, byId, cites, a, b };
}

function writeDisputes() {
  const { all, cites, a, b } = loadBoth();
  const disputes = [];
  let agreed = 0;
  for (const post of all) {
    const result = pair(a.spans.get(post.id), b.spans.get(post.id));
    agreed += result.agreed.length;
    for (const x of [...result.onlyA, ...result.onlyB]) {
      disputes.push({ disputeId: `d-${String(disputes.length + 1).padStart(4, "0")}`, postId: post.id, text: post.text, quote: x.quote, start: x.start, end: x.end, citeId: x.citeId, entry: cites.get(x.citeId), note: x.note });
    }
  }
  writeFileSync(join(LABELS, "disputes.jsonl"), toJsonl(disputes));
  console.log(JSON.stringify({ agreed, disputes: disputes.length, labellerA: a.problems, labellerB: b.problems }));
}

/** Sentence ranges with the same boundaries the engine uses. */
function sentenceRanges(text) {
  const out = [];
  for (const m of text.matchAll(/[\s\S]+?(?:[.!?]+(?=\s|$)|\n|$)/g)) {
    if (m[0].trim()) out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Krippendorff's alpha for two coders and a binary value. Null when one value never occurs. */
export function binaryAlpha(pairs) {
  const n = pairs.length * 2;
  const ones = pairs.reduce((sum, [x, y]) => sum + x + y, 0);
  const zeros = n - ones;
  if (ones === 0 || zeros === 0) return null;
  const disagreements = pairs.filter(([x, y]) => x !== y).length;
  return 1 - ((n - 1) * disagreements) / (ones * zeros);
}

const groupOf = (citeId) => (citeId.startsWith("gv-t-") ? TERMS_GROUP : citeId);

function agreementByCheck(all, a, b) {
  const groups = [...new Set([...kit().rules.map((r) => r.id), TERMS_GROUP])];
  const result = {};
  for (const group of groups) {
    const units = [];
    for (const post of all) {
      const marks = (spans, s) => (spans.get(post.id).some((x) => groupOf(x.citeId) === group && x.start >= s.start && x.start < s.end) ? 1 : 0);
      for (const s of sentenceRanges(post.text)) units.push([marks(a.spans, s), marks(b.spans, s)]);
    }
    const alpha = binaryAlpha(units);
    result[group] = { sentences: units.length, positivesA: units.filter(([x]) => x).length, positivesB: units.filter(([, y]) => y).length, alpha: alpha === null ? null : Number(alpha.toFixed(3)), usable: alpha !== null && alpha >= ALPHA_FLOOR };
  }
  return result;
}

function finalise() {
  const { all, a, b } = loadBoth();
  const disputes = new Map(readJsonl("labels", "disputes.jsonl").map((d) => [d.disputeId, d]));
  const verdicts = readJsonl("labels", "adjudications.jsonl");
  if (verdicts.length !== disputes.size) throw new Error(`${verdicts.length} verdicts for ${disputes.size} disputes.`);
  const gold = new Map(all.map((p) => [p.id, []]));
  const ambiguous = new Map(all.map((p) => [p.id, []]));
  const clean = ({ quote, start, end, citeId }) => ({ quote, start, end, citeId });
  for (const post of all) gold.get(post.id).push(...pair(a.spans.get(post.id), b.spans.get(post.id)).agreed.map(clean));
  const tally = { confirm: 0, reject: 0, ambiguous: 0 };
  for (const { disputeId, verdict } of verdicts) {
    const d = disputes.get(disputeId);
    if (!d || !(verdict in tally)) throw new Error(`Bad adjudication for ${disputeId}.`);
    tally[verdict] += 1;
    if (verdict === "confirm") gold.get(d.postId).push(clean(d));
    if (verdict === "ambiguous") ambiguous.get(d.postId).push(clean(d));
  }
  const rows = all.map((p) => ({ postId: p.id, split: p.split, gold: gold.get(p.id).sort((x, y) => x.start - y.start), ambiguous: ambiguous.get(p.id) }));
  const body = toJsonl(rows);
  writeFileSync(join(LABELS, "gold.jsonl"), body);
  const manifest = {
    method: "Two independent Claude labellers with different prompts, then a third Claude adjudicator. Not human annotators.",
    model: MODEL,
    goldSha256: sha256(body),
    kitSha256: sha256(read("kit", "govuk-style-kit.json")),
    corpusSha256: sha256(read("corpus", "posts.jsonl")),
    promptSha256: { labellerA: sha256(read("labelling", "labeller-a.md")), labellerB: sha256(read("labelling", "labeller-b.md")), adjudicator: sha256(read("labelling", "adjudicator.md")) },
    counts: { posts: all.length, goldLabels: rows.reduce((s, r) => s + r.gold.length, 0), ambiguous: tally.ambiguous, adjudicated: tally },
    agreement: agreementByCheck(all, a, b),
  };
  writeFileSync(join(LABELS, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ counts: manifest.counts, goldSha256: manifest.goldSha256, agreement: manifest.agreement }));
}

const COMMANDS = { kit: writeLabellerKit, disputes: writeDisputes, finalise };

function main() {
  mkdirSync(LABELS, { recursive: true });
  const run = COMMANDS[process.argv[2]];
  if (!run) throw new Error(`Use one of: ${Object.keys(COMMANDS).join(", ")}`);
  run();
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
