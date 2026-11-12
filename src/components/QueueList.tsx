"use client";

import { motion } from "motion/react";
import { Bot, ChevronRight, ShieldQuestion } from "lucide-react";
import Link from "next/link";
import type { SubmissionSummary } from "@/lib/db/repo";
import { Pill, ScoreRing, StatusPill, timeAgo } from "./ui";

export function QueueList({ items }: { items: SubmissionSummary[] }) {
  return (
    <ul className="grid gap-2.5">
      {items.map((s, i) => (
        <motion.li
          key={s.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={`/s/${s.id}`}
            className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-line bg-white p-3.5 pr-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-ash-300 hover:shadow-lift sm:p-4"
          >
            <ScoreRing score={s.score} size={52} stroke={5} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="truncate text-[17px] font-semibold text-ink">{s.title}</h2>
                <StatusPill s={s.status} />
                {s.aiAssisted && (
                  <Pill className="bg-white text-muted ring-line">
                    <Bot className="size-3" /> AI-assisted
                  </Pill>
                )}
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-muted">{s.excerpt}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                <span>{s.channel}</span>
                <span aria-hidden>·</span>
                <span>v{s.version}</span>
                <span aria-hidden>·</span>
                <span suppressHydrationWarning>{timeAgo(s.updatedAt)}</span>
                <span className="flex flex-wrap items-center gap-1.5 sm:ml-1">
                  <Count n={s.blockers} cls="bg-red" label="blocker" />
                  <Count n={s.warnings} cls="bg-amber" label="warning" />
                  <Count n={s.suggestions} cls="bg-ash-400" label="suggestion" />
                </span>
                {s.routed > 0 && (
                  <span className="flex items-center gap-1 text-ash-700">
                    <ShieldQuestion className="size-3.5" /> {s.routed} routed to reviewer
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="size-5 text-ash-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ash-600" />
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}

const TONE: Record<string, string> = {
  blocker: "bg-red-50 text-red-700 ring-red/20",
  warning: "bg-amber-50 text-amber-800 ring-amber/25",
  suggestion: "bg-ash-50 text-ash-700 ring-ash-200",
};

/** A labelled count, e.g. "2 blockers". Zero counts are left out so the row stays quiet. */
function Count({ n, cls, label }: { n: number; cls: string; label: string }) {
  if (!n) return null;
  const plural = n === 1 ? label : `${label}s`;
  return (
    <span className={`num inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset ${TONE[label]}`} title={`${n} open ${plural}`}>
      <span className={`size-1.5 rounded-full ${cls}`} aria-hidden />
      {n} {plural}
    </span>
  );
}
