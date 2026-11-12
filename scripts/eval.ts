// Runs the accuracy test. Usage: npm run eval -- --split dev --version dev-1 [--no-seeded-ai] [--show-errors]
// The sealed holdout only runs against the exact engine code tagged eval-lock, and never prints its errors.

import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { geminiProvider } from "../src/lib/ai/gemini";
import { evaluate, recordingProvider, type Agreement, type CallStats, type GoldRow, type Post } from "../src/lib/eval/run";
import type { BrandKit } from "../src/lib/types";

const SEEDS = { dev: 1101, holdout: 2202 };
const ENGINE_PATHS = "src/lib/engine src/lib/eval src/lib/ai eval/kit eval/labels";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const readLines = <T>(file: string): T[] => readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as T);

function refuseUnlessLocked() {
  try {
    execSync(`git diff --quiet eval-lock -- ${ENGINE_PATHS}`, { stdio: "ignore" });
  } catch {
    throw new Error("The holdout only runs on the exact code tagged eval-lock. Commit or tag first, with no engine edits in progress.");
  }
}

async function main() {
  const split = arg("split") === "holdout" ? "holdout" : "dev";
  const version = arg("version");
  if (!version || !/^[\w.-]+$/.test(version)) throw new Error("Give a --version made of letters, digits, dots or dashes.");
  if (split === "holdout") refuseUnlessLocked();
  const model = process.env.GEMINI_MODEL?.trim();
  if (!model) throw new Error("Set GEMINI_MODEL so the whole run uses one pinned model.");
  const inner = geminiProvider();
  if (!inner) throw new Error("GEMINI_API_KEY is required.");
  const stats: CallStats = { live: 0, cached: 0, failed: 0 };
  const manifest = JSON.parse(readFileSync("eval/labels/manifest.json", "utf8")) as { agreement: Agreement };
  const { report, outputs } = await evaluate({
    version,
    split,
    seed: SEEDS[split],
    kit: JSON.parse(readFileSync("eval/kit/govuk-style-kit.json", "utf8")) as BrandKit,
    corpus: readLines<Post>("eval/corpus/posts.jsonl"),
    labels: readLines<GoldRow>("eval/labels/gold.jsonl"),
    agreement: manifest.agreement,
    provider: recordingProvider(inner, stats),
    stats,
    seededAi: !flag("no-seeded-ai"),
    onProgress: (message) => console.log(message),
  });
  mkdirSync("public/eval", { recursive: true });
  writeFileSync(`public/eval/${version}.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ posts: report.posts, calls: report.calls, overall: report.overall.plumbline.strict.tally, seededCode: report.seeded.code.tally, seededAi: report.seeded.ai?.tally ?? null }));
  if (flag("show-errors") && split === "dev") {
    const corpus = new Map(readLines<Post>("eval/corpus/posts.jsonl").map((p) => [p.id, p.text]));
    const labels = new Map(readLines<GoldRow>("eval/labels/gold.jsonl").map((l) => [l.postId, l.gold]));
    for (const output of outputs) {
      const text = corpus.get(output.id) ?? "";
      const gold = labels.get(output.id) ?? [];
      for (const p of output.predictions.plumbline) {
        if (!gold.some((g) => g.citeId === p.citeId && p.start < g.end && p.end > g.start)) console.log(`FP ${p.citeId}: ${text.slice(p.start, p.end).slice(0, 90)}`);
      }
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
