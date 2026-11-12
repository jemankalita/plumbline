import Link from "next/link";
import holdout from "../../../../public/eval/holdout-1.json";
import media from "../../../../public/eval/media-1.json";
import type { CheckResult, EvalReport, Scored } from "@/lib/eval/run";
import { badge, type Interval } from "@/lib/eval/metrics";
import { USER_FIXES, USER_TEST_LIMIT, USER_TESTERS } from "@/lib/user-tests";

export const metadata = { title: "How accurate" };

const report = holdout as unknown as EvalReport;

const SYSTEMS: { id: keyof EvalReport["overall"]; name: string; note: string }[] = [
  { id: "plumbline", name: "Plumbline", note: "Rules, then AI, then the verifier" },
  { id: "rulesOnly", name: "Rules only", note: "No AI at all" },
  { id: "noVerifier", name: "Without the verifier", note: "Every AI finding is shown" },
  { id: "plainGemini", name: "Plain Gemini", note: "The style guide pasted into one prompt" },
];

const BADGE_HELP: Record<string, string> = {
  "AI-referenced": "At least 30 real cases, and the two AI labellers agreed.",
  Indicative: "10 to 29 real cases. Treat it as a rough guide.",
  "Not enough evidence": "Fewer than 10 cases, so no claim is made.",
  "Labels disagree": "The two AI labellers disagreed too often to trust these labels.",
};

function percent(i: Interval): string {
  if (i.value === null || i.low === null || i.high === null) return "No data";
  return `${Math.round(i.value * 100)}% (${Math.round(i.low * 100)}–${Math.round(i.high * 100)}%)`;
}

/** This table shows real posts, so the badge rests only on real posts. Planted tests have their own column. */
const shownBadge = (c: CheckResult) => badge({ knownTruth: 0, labelled: c.tally.tp + c.tally.fn, alpha: c.alpha });
const evidence = (c: CheckResult) => c.tally.tp + c.tally.fp + c.tally.fn;

const BADGE_TONE: Record<string, string> = {
  "AI-referenced": "bg-green-50 text-green-700 ring-green/25",
  Indicative: "bg-amber-50 text-amber-700 ring-amber/25",
  "Not enough evidence": "bg-ash-50 text-ash-700 ring-ash-200",
  "Labels disagree": "bg-red-50 text-red-700 ring-red/25",
};

/** A row with no score at all says nothing yet, so it waits behind a button. */
const isThin = (c: CheckResult) => shownBadge(c) === "Not enough evidence" && c.precision.value === null && c.recall.value === null;

function CheckHead() {
  return (
    <thead>
      <tr className="border-b border-ink/80 text-left text-[13px] text-ash-700">
        <th className="px-3 py-2 font-medium">Check</th>
        <th className="px-3 py-2 font-medium">Trust</th>
        <th className="px-3 py-2 text-right font-medium">Right when it flags</th>
        <th className="px-3 py-2 text-right font-medium">Issues found</th>
        <th className="px-3 py-2 text-right font-medium">Planted tests</th>
      </tr>
    </thead>
  );
}

function CheckRow({ c }: { c: CheckResult }) {
  const b = shownBadge(c);
  return (
    <tr className="border-b border-hair last:border-0">
      <td className="px-3 py-2.5">{c.name}</td>
      <td className="px-3 py-2.5" title={BADGE_HELP[b]}>
        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset ${BADGE_TONE[b] ?? BADGE_TONE["Not enough evidence"]}`}>{b}</span>
      </td>
      <Scores s={c} />
      <td className="num px-3 py-2.5 text-right">{c.knownTruth}</td>
    </tr>
  );
}

function Scores({ s }: { s: Scored }) {
  return (
    <>
      <td className="num px-3 py-2.5 text-right">{percent(s.precision)}</td>
      <td className="num px-3 py-2.5 text-right">{percent(s.recall)}</td>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-3 grid gap-3 text-[15px] text-ink">{children}</div>
    </section>
  );
}

export default function TrustPage() {
  const main = report.overall.plumbline.strict;
  const checks = [...report.checks].sort((a, b) => evidence(b) - evidence(a));
  const scored = checks.filter((c) => !isThin(c));
  const thin = checks.filter(isThin);
  const excluded = report.posts.excludedForAiFailure;
  const rules = report.overall.rulesOnly.strict.tally;
  const aiExtraFound = main.tally.tp - rules.tp;
  const aiExtraWrong = main.tally.fp - rules.fp;
  const sentenceFinds = report.checks.find((c) => c.id === "gv-sentence-length")?.tally.tp ?? 0;
  return (
    <div className="grid gap-6">
      <div>
        <p className="kicker">Accuracy report · {report.version}</p>
        <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink">How accurate is it?</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          Tested once on {report.posts.scored} posts that were sealed away until every engine change was finished. Run with {report.model}.
          {excluded > 0 && ` ${excluded} more posts were left out because the AI call failed.`}
          {" "}Two changes came after this test: comparing numbers with approved facts by unit and currency, and new video and logo checks. Neither affects these scores, because the test brand has no approved facts and these posts are text only.
        </p>
      </div>

      <dl className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
          <dt className="text-[13px] text-muted">When it flags something, it is right</dt>
          <dd className="num mt-1 text-[30px] font-semibold leading-none text-ink">{percent(main.precision)}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3.5">
          <dt className="text-[13px] text-muted">Of the real issues, it finds</dt>
          <dd className="num mt-1 text-[30px] font-semibold leading-none text-ink">{percent(main.recall)}</dd>
        </div>
      </dl>

      <Section title="Compared with simpler approaches">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink/80 text-left text-[13px] text-ash-700">
                <th className="px-3 py-2 font-medium">System</th>
                <th className="px-3 py-2 text-right font-medium">Right when it flags</th>
                <th className="px-3 py-2 text-right font-medium">Issues found</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEMS.map((s) => (
                <tr key={s.id} className="border-b border-hair last:border-0">
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{s.name}</span> <span className="text-muted">· {s.note}</span>
                  </td>
                  <Scores s={report.overall[s.id].strict} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Compared with rules alone, the AI step found <b className="num font-medium">{aiExtraFound}</b> more real issues and added <b className="num font-medium">{aiExtraWrong}</b> more {aiExtraWrong === 1 ? "false alarm" : "false alarms"}. Most of the accuracy here comes from the code rules. The sentence-length check alone is {sentenceFinds} of the {main.tally.tp} correct finds.
        </p>
        <p className="text-[13px] text-muted">Brackets show the 95% range. A finding counts only if it cites the right rule in the right place.</p>
      </Section>

      <Section title="Planted errors">
        <p>
          Code checks caught <b className="num font-medium">{report.seeded.code.tally.tp}</b> of <b className="num font-medium">{report.seeded.code.tally.tp + report.seeded.code.tally.fn}</b> planted errors, with <b className="num font-medium">{report.seeded.code.tally.fp}</b> {report.seeded.code.tally.fp === 1 ? "false alarm" : "false alarms"} on the same number of correct sentences. These sentences come from templates, so they are easier than real writing.
        </p>
        {report.seeded.ai && (
          <p>
            AI-judged rules, on {report.seeded.aiDocuments} documents with planted errors: right {percent(report.seeded.ai.precision)} of the time when flagging, and found {percent(report.seeded.ai.recall)}.
          </p>
        )}
        <p>
          Logo checks on generated pictures: {media.logo.clean.passed} of {media.logo.clean.total} correct logos passed, {media.logo.stretched.caught} of {media.logo.stretched.total} stretched and {media.logo.recoloured.caught} of {media.logo.recoloured.total} recoloured logos were caught. Clear space: {media.clearSpace.intruded.caught} of {media.clearSpace.intruded.total} logos with something too close were caught, and {media.clearSpace.clean.passed} of {media.clearSpace.clean.total} with room passed. Palette checks were correct on {media.palette.onPalette.correct + media.palette.offPalette.correct} of {media.palette.onPalette.total + media.palette.offPalette.total} pictures.
        </p>
      </Section>

      <Section title="Check by check, on real posts">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <CheckHead />
            <tbody>
              {scored.map((c) => (
                <CheckRow key={c.id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
        {thin.length > 0 && (
          <details className="group rounded-xl border border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-ink hover:bg-ash-50 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="group-open:hidden">Show</span>
                <span className="hidden group-open:inline">Hide</span> {thin.length} checks with too few cases
              </span>
              <span className="text-[13px] font-normal text-muted">fewer than 10 real cases, so no score yet</span>
            </summary>
            <div className="overflow-x-auto border-t border-hair">
              <table className="w-full min-w-[640px] text-sm">
                <CheckHead />
                <tbody>
                  {thin.map((c) => (
                    <CheckRow key={c.id} c={c} />
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        <ul className="grid gap-1 text-[13px] text-muted">
          {Object.entries(BADGE_HELP).map(([name, help]) => (
            <li key={name}>
              <b className="font-medium text-ink">{name}:</b> {help}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Tested by real people">
        <p>
          Separately from the scores above, <b className="num font-medium">{USER_TESTERS.length}</b> real people used Plumbline. We fixed <b className="num font-medium">{USER_FIXES.length}</b> problems they found.
        </p>
        <p className="text-[13px] text-muted">{USER_TEST_LIMIT}</p>
        <p>
          <Link href="/#tested" className="font-medium underline underline-offset-4">See who tested it and what changed</Link>
        </p>
      </Section>

      <Section title="What these numbers do not show">
        <ul className="grid list-inside list-disc gap-1.5">
          {[...report.limits, ...media.limits].map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
