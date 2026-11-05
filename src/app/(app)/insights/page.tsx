import { ArrowRight, Lightbulb, TrendingUp } from "lucide-react";
import Link from "next/link";
import { insights } from "@/lib/db/repo";

export const metadata = { title: "Insights" };

const TYPE_LABEL: Record<string, string> = {
  terminology: "Terminology",
  tone: "Tone",
  messaging: "Messaging",
  claim: "Claims",
  readability: "Readability",
  accessibility: "Accessibility",
  visual: "Visual",
  legal: "Legal",
};

export default async function InsightsPage() {
  const d = await insights();
  const maxType = Math.max(1, ...d.byType.map((t) => t.count));

  return (
    <div className="grid gap-8">
      <div>
        <p className="kicker">Learning loop</p>
        <h1 className="mt-1 font-serif text-[40px] leading-none tracking-tight text-navy sm:text-5xl">Insights</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          What keeps going wrong, and which rules people keep overriding. When a rule is overridden again and again, the rule is probably unclear, not the writers.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          ["Drafts", d.totals.submissions],
          ["Checks run", d.totals.reviews],
          ["Findings", d.totals.findings],
          ["Open blockers", d.totals.openBlockers],
          ["Approved", d.totals.approved],
          ["Avg. score", d.totals.avgScore],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-soft">
            <dt className="text-[13px] text-muted">{l}</dt>
            <dd className="num mt-1 font-serif text-4xl leading-none text-navy">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Gap Finder */}
      <section className="overflow-hidden rounded-2xl border border-sky-300 bg-gradient-to-br from-white to-sky-50 shadow-soft">
        <div className="flex items-center gap-2 border-b border-sky-200 px-5 py-3">
          <Lightbulb className="size-4 text-sky-600" />
          <p className="kicker">Guideline Gap Finder · early version</p>
        </div>
        <div className="grid gap-4 p-5">
          {d.gaps.length === 0 ? (
            <p className="text-sm text-muted">No unclear rules yet. A rule shows up here once it has 3+ decisions and at least half of them are overrides or dismissals.</p>
          ) : (
            d.gaps.map((g) => (
              <div key={g.id} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-sky-700">{g.label} · possibly unclear</p>
                  <p className="mt-1 font-serif text-[26px] leading-tight text-navy">{g.title}</p>
                  <p className="mt-1 text-sm text-ink">
                    Overridden or dismissed <b className="num font-medium text-navy">{g.overridden}</b> of <b className="num font-medium text-navy">{g.decided}</b> times. Reasons given:
                  </p>
                  <ul className="mt-2 grid gap-1">
                    {g.reasons.map((r, i) => (
                      <li key={i} className="font-serif text-[17px] italic text-ink">
                        “{r}”
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-ink">
                    <b className="font-medium text-navy">Suggestion:</b> reviewers keep citing the same exceptions. Write them into {g.label} so writers know when it
                    applies, or lower its severity.
                  </p>
                </div>
                <div className="grid justify-items-start gap-3 md:justify-items-end">
                  <div className="relative grid size-24 place-items-center">
                    <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-sky-100)" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--color-coral)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${g.rate * 97.4} 97.4`} />
                    </svg>
                    <span className="num font-serif text-3xl text-coral">{Math.round(g.rate * 100)}%</span>
                  </div>
                  <Link href="/kit" className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:underline">
                    Rewrite in Brand Kit <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="kicker">Findings by issue type</p>
          <ul className="mt-4 grid gap-2.5">
            {d.byType.map((t) => (
              <li key={t.type} className="grid grid-cols-[110px_1fr_32px] items-center gap-3 text-sm">
                <span className="text-ink">{TYPE_LABEL[t.type] ?? t.type}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-sky-50">
                  <span
                    className={`block h-full rounded-full ${t.type === "claim" || t.type === "legal" ? "bg-coral" : t.type === "accessibility" ? "bg-amber" : "bg-sky-400"}`}
                    style={{ width: `${(t.count / maxType) * 100}%` }}
                  />
                </span>
                <span className="num text-right font-mono text-xs text-navy">{t.count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="kicker">AI-assisted vs human drafts · first version</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {d.aiVsHuman.map((g) => (
              <div key={g.group} className="rounded-xl bg-sky-50 p-4">
                <p className="text-[13px] text-muted">{g.group}</p>
                <p className="num mt-1 font-serif text-4xl leading-none text-navy">{g.avgFindings}</p>
                <p className="text-xs text-muted">findings per draft</p>
                <p className="num mt-2 text-xs text-ink">
                  {g.claimIssues} claim issue{g.claimIssues === 1 ? "" : "s"} · {g.drafts} draft{g.drafts === 1 ? "" : "s"}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Our class survey (n = 50) suggested heavy AI drafting goes with more factual errors. This view tests that on real drafts.</p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <p className="kicker px-5 pt-5">Most-cited Brand Kit records</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/80 text-left font-mono text-[10.5px] uppercase tracking-[0.12em] text-sky-700">
                  <th className="px-5 py-2 font-medium">Record</th>
                  <th className="px-2 py-2 text-right font-medium">Flags</th>
                  <th className="px-2 py-2 text-right font-medium">Fixed</th>
                  <th className="px-5 py-2 text-right font-medium">Overridden</th>
                </tr>
              </thead>
              <tbody>
                {d.byRule.slice(0, 10).map((r) => (
                  <tr key={r.id} className="border-b border-hair last:border-0">
                    <td className="px-5 py-2.5">
                      <span className="font-mono text-[11px] text-sky-600">{r.label}</span> <span className="text-navy">{r.title}</span>
                    </td>
                    <td className="num px-2 py-2.5 text-right">{r.count}</td>
                    <td className="num px-2 py-2.5 text-right text-mint-700">{r.accepted}</td>
                    <td className={`num px-5 py-2.5 text-right ${r.overridden ? "text-coral-700" : "text-muted"}`}>{r.overridden}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <p className="kicker flex items-center gap-1.5">
            <TrendingUp className="size-3.5" /> Score from first to latest version
          </p>
          <ul className="mt-4 grid gap-3">
            {d.scores.map((s) => (
              <li key={s.title} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate text-navy">{s.title}</span>
                  <span className="num shrink-0 font-mono text-xs text-muted">
                    {s.first} → <b className={s.latest >= 85 ? "text-mint-700" : s.latest >= 60 ? "text-amber-700" : "text-coral-700"}>{s.latest}</b>
                    {s.versions > 1 && ` · ${s.versions} versions`}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2 rounded-full bg-sky-50">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-sky-200" style={{ width: `${s.first}%` }} />
                  <span className="absolute inset-y-0 left-0 rounded-full bg-sky-600" style={{ width: `${s.latest}%`, opacity: 0.85 }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
