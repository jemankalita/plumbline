// The accuracy harness. Scores Plumbline and three simpler systems on the same posts, with one pinned model.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { LlmOptions, LlmPart, LlmProvider } from "../ai/gemini";
import { runReview } from "../engine";
import { sentences } from "../engine/text";
import type { BrandKit, Finding } from "../types";
import { matchPost, type GoldLabel, type MatchMode, type Predicted, type Span } from "./match";
import { addTally, badge, emptyTally, labelsUsable, precision, recall, type Badge, type Interval, type Tally } from "./metrics";
import { aiDocuments, codeCases, type SeededCase } from "./seeded";

export interface Post {
  id: string;
  split: "dev" | "holdout";
  text: string;
}

export interface GoldRow {
  postId: string;
  split: "dev" | "holdout";
  gold: GoldLabel[];
  ambiguous: GoldLabel[];
}

export type System = "plumbline" | "rulesOnly" | "noVerifier" | "plainGemini";
const SYSTEMS: System[] = ["plumbline", "rulesOnly", "noVerifier", "plainGemini"];

const CACHE_FILE = path.join("eval", ".cache", "ai.jsonl");
const CALL_GAP_MS = 5000;
const RATE_LIMIT_WAIT_MS = 40_000;
const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface CallStats {
  live: number;
  cached: number;
  failed: number;
}

/** Saves every answer, so re-running after an engine change costs no quota unless the prompt changed. */
export function recordingProvider(inner: LlmProvider, stats: CallStats): LlmProvider {
  mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  const cache = new Map<string, unknown>();
  if (existsSync(CACHE_FILE)) {
    for (const line of readFileSync(CACHE_FILE, "utf8").split("\n").filter(Boolean)) {
      const row = JSON.parse(line) as { key: string; value: unknown };
      cache.set(row.key, row.value);
    }
  }
  let lastCall = 0;
  return {
    name: inner.name,
    async json<T>(system: string, parts: LlmPart[], opts?: LlmOptions): Promise<T> {
      const key = createHash("sha256").update(JSON.stringify([inner.name, system, parts])).digest("hex");
      if (cache.has(key)) {
        stats.cached++;
        return cache.get(key) as T;
      }
      for (let attempt = 0; ; attempt++) {
        await sleep(Math.max(0, lastCall + CALL_GAP_MS - Date.now()));
        lastCall = Date.now();
        try {
          const value = await inner.json<T>(system, parts, { ...opts, onlyPreferred: true, deadlineMs: undefined, timeoutMs: 45_000 });
          stats.live++;
          cache.set(key, value);
          appendFileSync(CACHE_FILE, `${JSON.stringify({ key, value })}\n`);
          return value;
        } catch (error) {
          if (attempt + 1 >= MAX_RETRIES) {
            stats.failed++;
            throw error;
          }
          await sleep(RATE_LIMIT_WAIT_MS);
        }
      }
    },
  };
}

const toPredicted = (f: Finding): Predicted => ({ start: f.start, end: f.end, citeId: f.cites.id });

function bySentenceFor(kit: BrandKit) {
  const judged = new Set(kit.rules.filter((r) => r.category === "tone" || r.category === "messaging").map((r) => r.id));
  return (citeId: string) => judged.has(citeId);
}

function plainSystem(kit: BrandKit): string {
  const rules = kit.rules.map((r) => `- ${r.id}: ${r.title}. ${r.text}`).join("\n");
  const terms = kit.terms.map((t) => `- ${t.id}: use "${t.preferred}", not ${t.banned.join(", ")}`).join("\n");
  return `Check the text against this style guide.\n\nRules:\n${rules}\n\nTerms:\n${terms}\n\nReply with JSON only: {"findings":[{"quote":"exact words from the text","ruleId":"id"}]}`;
}

interface RawFinding {
  quote?: unknown;
  ruleId?: unknown;
}

function locate(text: string, raw: RawFinding[]): Predicted[] {
  return raw.flatMap((r) => {
    if (typeof r?.ruleId !== "string" || typeof r?.quote !== "string") return [];
    const start = r.quote ? text.indexOf(r.quote) : -1;
    return [{ start, end: start < 0 ? -1 : start + r.quote.length, citeId: r.ruleId }];
  });
}

interface PostOutput {
  id: string;
  predictions: Record<System, Predicted[]>;
  aiFailed: boolean;
}

async function checkPost(post: Post, kit: BrandKit, provider: LlmProvider): Promise<PostOutput> {
  let rawJudgement: RawFinding[] = [];
  const capture: LlmProvider = {
    name: provider.name,
    async json<T>(system: string, parts: LlmPart[], opts?: LlmOptions) {
      const reply = await provider.json<T>(system, parts, opts);
      rawJudgement = (reply as { findings?: RawFinding[] }).findings ?? [];
      return reply;
    },
  };
  const review = await runReview({ text: post.text, kit, provider: capture });
  const aiFailed = review.ai.calls.some((c) => c.status === "failed");
  const code = review.findings.filter((f) => !f.ai).map(toPredicted);
  let plain: RawFinding[] = [];
  let plainFailed = false;
  try {
    plain = (await provider.json<{ findings?: RawFinding[] }>(plainSystem(kit), [{ text: post.text }])).findings ?? [];
  } catch {
    plainFailed = true;
  }
  return {
    id: post.id,
    aiFailed: aiFailed || plainFailed,
    predictions: { plumbline: review.findings.map(toPredicted), rulesOnly: code, noVerifier: [...code, ...locate(post.text, rawJudgement)], plainGemini: locate(post.text, plain) },
  };
}

type PerCheck = Map<string, Tally>;

function addToCheck(map: PerCheck, citeId: string, change: Partial<Tally>) {
  map.set(citeId, addTally(map.get(citeId) ?? emptyTally(), { ...emptyTally(), ...change }));
}

function score(rows: { text: string; gold: GoldLabel[]; ambiguous: GoldLabel[]; predicted: Predicted[]; sentences: Span[] }[], kit: BrandKit, mode: MatchMode): PerCheck {
  const bySentence = bySentenceFor(kit);
  const perCheck: PerCheck = new Map();
  for (const row of rows) {
    const result = matchPost({ ...row, bySentence, mode });
    const missedCount = new Map<string, number>();
    result.missed.forEach((m) => {
      addToCheck(perCheck, m.citeId, { fn: 1 });
      missedCount.set(m.citeId, (missedCount.get(m.citeId) ?? 0) + 1);
    });
    result.falsePositives.forEach((f) => addToCheck(perCheck, f.citeId, { fp: 1 }));
    const goldCount = new Map<string, number>();
    row.gold.forEach((g) => goldCount.set(g.citeId, (goldCount.get(g.citeId) ?? 0) + 1));
    goldCount.forEach((n, citeId) => addToCheck(perCheck, citeId, { tp: n - (missedCount.get(citeId) ?? 0) }));
  }
  return perCheck;
}

export interface Scored {
  tally: Tally;
  precision: Interval;
  recall: Interval;
}

const scored = (tally: Tally): Scored => ({ tally, precision: precision(tally), recall: recall(tally) });

export interface CheckResult extends Scored {
  id: string;
  name: string;
  alpha: number | null;
  badge: Badge;
  knownTruth: number;
}

export interface EvalReport {
  version: string;
  split: "dev" | "holdout";
  model: string;
  seed: number;
  posts: { total: number; scored: number; excludedForAiFailure: number };
  calls: CallStats;
  overall: Record<System, Record<MatchMode, Scored>>;
  checks: CheckResult[];
  seeded: { code: Scored; ai: Scored | null; aiDocuments: number };
  limits: string[];
}

export type Agreement = Record<string, { alpha: number | null }>;

const alphaFor = (id: string, agreement: Agreement) => (id.startsWith("gv-t-") ? agreement.terms?.alpha ?? null : agreement[id]?.alpha ?? null);

const posts = (rows: Post[], split: string) => rows.filter((p) => p.split === split);

function ruleName(kit: BrandKit, id: string): string {
  return kit.rules.find((r) => r.id === id)?.title ?? kit.terms.find((t) => t.id === id)?.preferred ?? id;
}

async function scoreSeeded(kit: BrandKit, provider: LlmProvider, seed: number, withAi: boolean) {
  const rows = (cases: SeededCase[], predict: (c: SeededCase) => Promise<Predicted[]>) =>
    Promise.all(cases.map(async (c) => ({ text: c.text, gold: c.gold, ambiguous: [], sentences: sentences(c.text) as Span[], predicted: (await predict(c)).filter((p) => p.citeId === c.citeId) })));
  const coded = await rows(codeCases(kit, seed), async (c) => (await runReview({ text: c.text, kit })).findings.map(toPredicted));
  const code = score(coded, kit, "strict");
  const docs = withAi ? aiDocuments(seed) : [];
  const aiRows = [];
  for (const doc of docs) {
    const [row] = await rows([doc], async (c) => {
      const review = await runReview({ text: c.text, kit, provider });
      return review.findings.filter((f) => f.ai).map(toPredicted);
    });
    aiRows.push(row);
  }
  const ai = score(aiRows, kit, "strict");
  return { code, ai, aiDocuments: docs.length };
}

const total = (map: PerCheck, keep: (id: string) => boolean = () => true) => [...map.entries()].filter(([id]) => keep(id)).reduce((sum, [, t]) => addTally(sum, t), emptyTally());

export interface EvalOptions {
  version: string;
  split: "dev" | "holdout";
  seed: number;
  kit: BrandKit;
  corpus: Post[];
  labels: GoldRow[];
  agreement: Agreement;
  provider: LlmProvider;
  stats: CallStats;
  seededAi: boolean;
  onProgress: (message: string) => void;
}

export async function evaluate(o: EvalOptions): Promise<{ report: EvalReport; outputs: PostOutput[] }> {
  const chosen = posts(o.corpus, o.split);
  const outputs: PostOutput[] = [];
  for (const [i, post] of chosen.entries()) {
    outputs.push(await checkPost(post, o.kit, o.provider));
    o.onProgress(`Post ${i + 1} of ${chosen.length}`);
  }
  const usable = outputs.filter((x) => !x.aiFailed);
  const labelOf = new Map(o.labels.map((l) => [l.postId, l]));
  const textOf = new Map(chosen.map((p) => [p.id, p.text]));
  const rowsFor = (system: System) =>
    usable.map((x) => {
      const text = textOf.get(x.id) as string;
      return { text, gold: labelOf.get(x.id)?.gold ?? [], ambiguous: labelOf.get(x.id)?.ambiguous ?? [], predicted: x.predictions[system], sentences: sentences(text) as Span[] };
    });
  const usableCheck = (id: string) => labelsUsable(alphaFor(id, o.agreement));
  const overallFor = (system: System) => {
    const part = (mode: MatchMode) => scored(total(score(rowsFor(system), o.kit, mode), usableCheck));
    return { strict: part("strict"), lenient: part("lenient") };
  };
  const seeded = await scoreSeeded(o.kit, o.provider, o.seed, o.seededAi);
  const main = score(rowsFor("plumbline"), o.kit, "strict");
  const known = new Map<string, number>();
  for (const map of [seeded.code, seeded.ai]) map.forEach((t, id) => known.set(id, (known.get(id) ?? 0) + t.tp + t.fn));
  const ids = [...new Set([...o.kit.rules.map((r) => r.id), ...main.keys(), ...known.keys()])].filter((id) => !id.startsWith("gv-t-"));
  const termIds = [...new Set([...main.keys(), ...known.keys()])].filter((id) => id.startsWith("gv-t-"));
  const check = (id: string, name: string, tally: Tally, knownTruth: number): CheckResult => {
    const alpha = alphaFor(id, o.agreement);
    return { id, name, alpha, knownTruth, badge: badge({ knownTruth, labelled: tally.tp + tally.fn, alpha }), ...scored(tally) };
  };
  const checks = [
    ...ids.map((id) => check(id, ruleName(o.kit, id), main.get(id) ?? emptyTally(), known.get(id) ?? 0)),
    check("gv-t-all", "Banned terms, all together", total(main, (id) => id.startsWith("gv-t-")), termIds.reduce((sum, id) => sum + (known.get(id) ?? 0), 0)),
  ];
  const report: EvalReport = {
    version: o.version,
    split: o.split,
    model: o.provider.name,
    seed: o.seed,
    posts: { total: chosen.length, scored: usable.length, excludedForAiFailure: chosen.length - usable.length },
    calls: o.stats,
    overall: Object.fromEntries(SYSTEMS.map((s) => [s, overallFor(s)])) as EvalReport["overall"],
    checks,
    seeded: { code: scored(total(seeded.code)), ai: o.seededAi ? scored(total(seeded.ai)) : null, aiDocuments: seeded.aiDocuments },
    limits: [
      "Reference labels were made by two AI labellers and an AI adjudicator, not people.",
      "The adjudicator confirmed or left ambiguous every disputed label and rejected none, so it may lean towards confirming.",
      "The posts are UK government news, not brand social posts.",
      "The AI step reports at most 6 findings per draft, which limits recall on long posts.",
      "Overall scores leave out checks where the two labellers disagreed too much to trust the labels.",
    ],
  };
  return { report, outputs };
}
