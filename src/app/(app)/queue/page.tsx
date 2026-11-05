import { ArrowRight, Bot, PenLine, Sparkles } from "lucide-react";
import Link from "next/link";
import { QueueList } from "@/components/QueueList";
import { currentRole } from "@/lib/auth";
import { listSubmissions } from "@/lib/db/repo";

export const metadata = { title: "Review queue" };

export default async function QueuePage(props: { searchParams: Promise<{ view?: string }> }) {
  const [{ view }, role, subs] = await Promise.all([props.searchParams, currentRole(), listSubmissions()]);

  const needsMe = subs.filter((s) => {
    if (role === "creator") return s.status === "draft" || s.status === "changes_requested";
    if (role === "reviewer") return s.routed > 0;
    if (role === "approver") return s.status === "in_review";
    return s.blockers > 0;
  });
  const shown = view === "all" ? subs : needsMe.length ? needsMe : subs;
  const filter = view === "all" || !needsMe.length ? "all" : "mine";

  const tiles = [
    { label: "Awaiting approval", value: subs.filter((s) => s.status === "in_review").length },
    { label: "Changes requested", value: subs.filter((s) => s.status === "changes_requested").length },
    { label: "Approved", value: subs.filter((s) => s.status === "approved").length },
    { label: "Open blockers", value: subs.reduce((n, s) => n + s.blockers, 0), hot: true },
  ];

  const hint = {
    creator: "Your drafts and anything sent back to you.",
    reviewer: "Drafts with claims or low-confidence items routed to you.",
    approver: "Pre-checked drafts waiting for your sign-off.",
    admin: "Drafts with open blockers, often a sign a rule needs attention.",
  }[role];

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Workspace · QuickKart (demo brand)</p>
          <h1 className="mt-1 font-serif text-[40px] leading-none tracking-tight text-navy sm:text-5xl">Review queue</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted">Every draft is checked against the Brand Kit before a person sees it. {hint}</p>
        </div>
        <Link
          href="/new"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white shadow-[0_6px_16px_-8px_rgb(13_34_54/0.6)] transition-[transform,background-color] hover:bg-sky-700 active:scale-[0.97]"
        >
          <PenLine className="size-4" /> Check a new draft
        </Link>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-white px-4 py-3.5 shadow-soft">
            <dt className="text-[13px] text-muted">{t.label}</dt>
            <dd className={`num mt-1 font-serif text-4xl leading-none ${t.hot && t.value ? "text-coral" : "text-navy"}`}>{t.value}</dd>
          </div>
        ))}
      </dl>

      <section className="grid gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-sky-100/60 p-1 text-sm sm:w-fit">
          <Link
            href="/queue"
            className={`flex-1 rounded-lg px-3 py-1.5 text-center transition-colors sm:flex-none ${filter === "mine" ? "bg-white font-medium text-navy shadow-soft" : "text-muted hover:text-navy"}`}
          >
            Needs you <span className="num ml-1 text-sky-600">{needsMe.length}</span>
          </Link>
          <Link
            href="/queue?view=all"
            className={`flex-1 rounded-lg px-3 py-1.5 text-center transition-colors sm:flex-none ${filter === "all" ? "bg-white font-medium text-navy shadow-soft" : "text-muted hover:text-navy"}`}
          >
            All drafts <span className="num ml-1 text-sky-600">{subs.length}</span>
          </Link>
        </div>
        {shown.length ? (
          <QueueList items={shown} />
        ) : (
          <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-sky-300 bg-white/60 px-6 py-16 text-center">
            <Sparkles className="size-6 text-sky-500" />
            <p className="font-serif text-2xl text-navy">Nothing in the queue yet</p>
            <Link href="/new" className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline">
              Check your first draft <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </section>

      <p className="flex items-center gap-2 text-xs text-muted">
        <Bot className="size-3.5" /> Drafts tagged “AI-assisted” are tracked separately in Insights, so you can see whether AI drafts need more fixing.
      </p>
    </div>
  );
}
