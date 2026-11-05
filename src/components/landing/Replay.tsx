"use client";

import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { score } from "@/lib/engine/verify";
import type { FindingRow } from "@/lib/types";
import { DraftView } from "../DraftView";
import { cx, SeverityBadge } from "../ui";
import { EASE, type ReplayFinding, type ReplayRun } from "./data";

const START_MS = 1000;
const STEP_MS = 1200;
const REVIEW_MS = 2400; // all findings are up: time to read them before the fixes land
const HOLD_MS = 5000;

/** The replay's current state, in the shape the draft view and the engine's scoring expect. */
function toRows(findings: ReplayFinding[], fixed: boolean): FindingRow[] {
  return findings.map((f) => ({ ...f, status: fixed && f.fix != null ? "accepted" : "open" })) as unknown as FindingRow[];
}

function Count({ value }: { value: number }) {
  const mv = useMotionValue(value);
  const shown = useTransform(mv, (v) => Math.round(v).toString());
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.6, ease: EASE });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span>{shown}</motion.span>;
}

function tally(rows: FindingRow[]): string {
  const open = rows.filter((r) => r.status === "open");
  if (open.length === 0) return rows.length ? "Nothing left open" : "Reading the draft";
  const count = (s: FindingRow["severity"]) => open.filter((r) => r.severity === s).length;
  const parts = [
    [count("blocker"), "blocker"],
    [count("warning"), "warning"],
    [count("suggestion"), "suggestion"],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, word]) => `${n} ${word}${n === 1 ? "" : "s"}`)
    .join(" · ");
}

/** A real check, played back: marks land in the draft, findings arrive, the score falls, then the fixes bring it back. */
export function Replay({ run }: { run: ReplayRun }) {
  const reduce = useReducedMotion();
  const n = run.findings.length;
  const last = n + 1; // steps 1..n reveal a finding each; the last step accepts the fixes
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const at = reduce ? n : step;

  useEffect(() => {
    if (reduce || paused) return;
    const delay = at === 0 ? START_MS : at === last ? HOLD_MS : at === n ? REVIEW_MS : STEP_MS;
    const t = setTimeout(() => setStep((s) => (s >= last ? 0 : s + 1)), delay);
    return () => clearTimeout(t);
  }, [at, last, n, paused, reduce]);

  const fixed = at === last;
  const revealed = run.findings.slice(0, Math.min(at, n));
  const rows = toRows(revealed, fixed);
  const latest = !fixed && at > 0 ? (revealed.at(-1)?.id ?? null) : null;
  const value = score(rows);
  const phase = fixed ? "Fixes accepted, ready for approval" : at >= n ? "A person decides each finding" : "Checking against the Brand Kit";

  return (
    <figure className="m-0">
      <div data-ui className="grid gap-1 lg:grid-cols-12" role="group" aria-label="Replay of a real check on a demo draft">
        <div className="flex min-h-[300px] flex-col bg-white p-5 text-soot sm:p-7 lg:col-span-7 lg:min-h-[500px] lg:p-9">
          <div className="flex items-center justify-between gap-4 text-[14px]">
            <p className="min-w-0 truncate font-medium">{run.title} · v1</p>
            {!reduce && (
              <button
                onClick={() => setPaused((p) => !p)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-ash-50 px-3 font-medium transition-colors hover:bg-ash-100"
              >
                {paused ? <Play className="size-3.5" aria-hidden /> : <Pause className="size-3.5" aria-hidden />}
                {paused ? "Play" : "Pause"}
              </button>
            )}
          </div>
          <div className="my-auto py-8">
            <DraftView text={run.text} findings={rows} activeId={latest} onSelect={() => {}} fixesOnly className="text-[21px] tracking-[-0.01em] sm:text-[26px] lg:text-[30px]" />
          </div>
          <p className="flex items-center gap-2 text-[14px] text-muted">
            <span className={cx("grid size-4 place-items-center rounded-full", fixed ? "bg-green text-white" : "bg-ash-100")} aria-hidden>
              {fixed && <Check className="size-3" strokeWidth={3} />}
            </span>
            {phase}
          </p>
        </div>

        <div className="grid grid-rows-[auto_1fr] gap-1 lg:col-span-5">
          <div className="flex items-end justify-between gap-4 bg-soot-3 p-5 text-white sm:p-6">
            <div>
              <p className="text-[15px] text-ash-300">Brand score</p>
              <p className="text-[15px]">{tally(rows)}</p>
            </div>
            <p className="num text-[64px] font-semibold leading-[0.85] tracking-[-0.04em] text-lime lg:text-[76px]">
              <Count value={value} />
            </p>
          </div>

          <div className="relative h-[372px] overflow-hidden bg-soot-2 lg:h-auto">
            <ul className="absolute inset-x-3 top-3 grid gap-1">
              <AnimatePresence initial={false}>
                {[...revealed].reverse().map((f) => {
                  const done = fixed && f.fix != null;
                  return (
                    <motion.li
                      key={f.id}
                      layout={!reduce}
                      initial={{ opacity: 0, y: -14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.45, ease: EASE }}
                      className={cx("grid gap-0.5 bg-white px-3 py-2 text-soot", f.id === latest && "outline-2 -outline-offset-2 outline-lime")}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {done ? (
                          <span className="inline-flex h-6 items-center gap-1 rounded-md bg-green-50 px-2 text-[13px] font-medium text-green-700">
                            <Check className="size-3.5" aria-hidden /> Fix accepted
                          </span>
                        ) : (
                          <SeverityBadge s={f.severity} />
                        )}
                        <span className="truncate text-[13px] text-muted">{f.cite}</span>
                      </div>
                      <p className="truncate text-[15px] font-medium">
                        “{f.quote}”{f.fix != null && <span className="font-normal text-green-700"> → {f.fix || "remove"}</span>}
                      </p>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 max-w-[90ch] text-[14px] leading-[1.5] text-ash-300">
        A real engine result for a demo draft, replayed at reading speed. The rules and claims passes ran, with no AI. The last step shows what happens when an editor accepts
        each suggested fix. QuickKart is a fictional brand.
      </figcaption>
    </figure>
  );
}
