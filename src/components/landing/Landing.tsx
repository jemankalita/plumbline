"use client";

import { LayoutGroup, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cx, Logo } from "../ui";
import { EASE, type BoardRow, type LandingData, type ReplayRun } from "./data";
import { Closing, Names, Panel, Playground } from "./LandingParts";
import { PhotoCheck } from "./PhotoCheck";
import { Replay } from "./Replay";

export function Landing(data: LandingData) {
  return (
    <div className="overflow-x-clip bg-white">
      <Masthead run={data.replay} />
      <Board rows={data.board} checked={data.checked} ms={data.boardMs} />
      <Stages />
      <Panel />
      <Playground aiOn={data.aiOn} />
      <PhotoCheck aiOn={data.aiOn} />
      <Names columns={data.columns} />
      <Closing />
    </div>
  );
}

/** Section parts rise in once, staggered, as the section enters. */
export function Reveal({ i = 0, className, children, ...rest }: { i?: number; className?: string; children: ReactNode } & HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay: i * 0.075, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// ---------- masthead: the headline, then the product working ----------

const NAV = [
  { href: "#board", label: "Live check" },
  { href: "#how", label: "How it works" },
  { href: "#try", label: "Try it" },
  { href: "#photos", label: "Check a photo" },
];

function Masthead({ run }: { run: ReplayRun }) {
  const reduce = useReducedMotion();
  const line = (text: string, k: number) => (
    <span className="mask-line" key={k}>
      <motion.span
        initial={reduce ? false : { y: "105%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 0.9, delay: 0.1 + k * 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        {text}
      </motion.span>
    </span>
  );
  const after = (k: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.45 + k * 0.1, ease: EASE } };

  return (
    <section className="on-soot bg-soot text-white">
      <header className="flex h-16 items-center gap-8 border-b border-white/10 px-[var(--margin)] text-[15px]">
        <Link href="/" aria-label="Plumbline home">
          <Logo tone="paper" />
        </Link>
        <nav className="hidden items-center gap-7 text-ash-300 md:flex" aria-label="Page">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-colors hover:text-white">
              {n.label}
            </a>
          ))}
          <a href="https://github.com/jemankalita/plumbline" className="transition-colors hover:text-white">
            Source
          </a>
        </nav>
        <Link href="/queue" className="lift ml-auto inline-flex h-10 items-center rounded-lg bg-lime px-4 font-medium text-soot hover:bg-lime-600">
          Open the workspace
        </Link>
      </header>

      <div className="grid gap-6 px-[var(--margin)] pb-10 pt-12 lg:grid-cols-12 lg:items-end lg:gap-8 lg:pb-14 lg:pt-20">
        <h1 className="display text-[44px] sm:text-[60px] lg:col-span-7 lg:text-[clamp(60px,6.2vw,96px)]">
          {line("On brand", 0)}
          {line("before it ships.", 1)}
        </h1>
        <motion.div {...after(0)} className="lg:col-span-5 lg:pb-2">
          <p className="max-w-[46ch] text-[17px] leading-[1.55] text-white lg:text-[18px]">
            Plumbline reads captions, emails and banners against your own brand rules and approved facts. Every finding cites the rule it breaks, and a person makes the call.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/new" className="lift inline-flex h-11 items-center rounded-lg bg-lime px-5 text-[15px] font-medium text-soot hover:bg-lime-600">
              Check a draft
            </Link>
            <a href="#try" className="text-[15px] font-medium text-white underline decoration-ash-500 underline-offset-4 hover:decoration-lime">
              Try one here first
            </a>
          </div>
        </motion.div>
      </div>

      <motion.div {...after(1)} className="px-[var(--margin)] pb-16 lg:pb-24">
        <Replay run={run} />
      </motion.div>
    </section>
  );
}

// ---------- the board: a real engine run, set like a departure board ----------

const STATUS_BLOCK = {
  blocker: "bg-red text-white",
  warning: "bg-amber text-soot",
  suggestion: "bg-ash-300 text-soot",
} as const;
const STATUS_WORD = { blocker: "Blocker", warning: "Warning", suggestion: "Suggestion" } as const;

function Board({ rows, checked, ms }: { rows: BoardRow[]; checked: LandingData["checked"]; ms: number }) {
  const [open, setOpen] = useState(Math.min(3, rows.length - 1));
  return (
    <section id="board" className="on-soot scroll-mt-4 border-t border-white/10 bg-soot pb-16 text-white lg:pb-24">
      <Reveal className="px-[var(--margin)] pb-10 pt-16 lg:pt-24">
        <h2 className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]">A live check</h2>
        <p className="mt-4 max-w-[56ch] text-[17px] leading-[1.55] text-white lg:text-[18px]">
          The engine read {checked.drafts} QuickKart drafts while this page loaded and found {checked.findings} things to fix, in <span className="num">{ms}</span> ms.{" "}
          {rows.length < checked.findings ? `Here are the first ${rows.length}. ` : ""}Pick any row to see why.
        </p>
      </Reveal>
      <div className="px-[var(--margin)]">
        <LayoutGroup>
          <ul data-ui className="grid gap-1" aria-label="Findings from the live check">
            {rows.map((r, i) => {
              const isOpen = i === open;
              return (
                <motion.li layout key={r.id} transition={{ duration: 0.35, ease: EASE }} className={cx(isOpen ? "bg-lime text-soot" : "bg-soot-2 text-white")}>
                  <button
                    onClick={() => setOpen(i)}
                    aria-expanded={isOpen}
                    className={cx(
                      "grid w-full grid-cols-[1fr_auto] items-center gap-x-4 px-3 text-left transition-colors lg:grid-cols-12 lg:px-5",
                      isOpen ? "py-5 lg:py-6" : "h-14 hover:bg-soot-3 lg:h-[60px]"
                    )}
                  >
                    <span className={cx("truncate font-medium tracking-[-0.02em]", isOpen ? "text-[20px] lg:text-[26px]" : "text-[16px] lg:text-[18px]", "lg:col-span-5")}>
                      “{r.quote}”
                    </span>
                    <span className={cx("hidden truncate text-[15px] lg:col-span-5 lg:block", isOpen ? "text-soot" : "text-ash-300")}>
                      <span className={isOpen ? "font-medium" : "font-medium text-white"}>{r.cite}</span> · {r.title}
                    </span>
                    <span className={cx("justify-self-end whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] font-medium lg:col-span-2 lg:text-[14px]", STATUS_BLOCK[r.severity])}>
                      {STATUS_WORD[r.severity]}
                    </span>
                    {isOpen && (
                      <motion.span
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
                        className="col-span-2 mt-3 grid max-w-[78ch] gap-1 text-[15px] leading-[1.5] lg:col-span-12 lg:text-[16px]"
                      >
                        <span>
                          {r.message} ({r.cite}, {r.draft} draft, {r.pass.toLowerCase()})
                        </span>
                        <span className="font-medium">{r.fix ? `Suggested fix: ${r.fix}` : `Cites ${r.cite}: ${r.title}`}</span>
                      </motion.span>
                    )}
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </LayoutGroup>
      </div>
    </section>
  );
}

// ---------- how it works: the progress bar, enlarged ----------

const STAGES = [
  { word: "First", time: "Two minutes", weight: 120, cls: "bg-ash-200 text-soot", clause: "First, a creator pastes the draft and locks the message that must survive." },
  { word: "Then", time: "Seconds", weight: 20, cls: "bg-lime text-soot", clause: "Then rules, claims, AI judgement and a verifier read it." },
  { word: "Next", time: "Ten minutes", weight: 600, cls: "bg-soot-3 text-white", clause: "Next, fixes are accepted or disputed, and v2 is checked again." },
  { word: "Last", time: "Same day", weight: 14400, cls: "bg-soot text-white", clause: "Last, a reviewer clears claims and an approver signs it off." },
];

function Stages() {
  const total = STAGES.reduce((s, x) => s + x.weight, 0);
  // true proportions, but nothing thinner than 16% so every stage stays readable
  const raw = STAGES.map((s) => Math.max(0.16, s.weight / total));
  const sum = raw.reduce((a, b) => a + b, 0);
  return (
    <section id="how" className="scroll-mt-4 bg-white px-[var(--margin)] py-[clamp(72px,8vw,128px)] text-soot">
      <Reveal>
        <h2 className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]">The machine part is a sliver</h2>
        <p className="mt-4 max-w-[56ch] text-[17px] leading-[1.55] text-muted lg:text-[18px]">Most of the time goes to people making decisions. The timings are illustrative, not measurements.</p>
      </Reveal>
      <div data-ui className="mt-12 grid gap-1.5 lg:flex lg:gap-1.5">
        {STAGES.map((s, i) => (
          <Reveal key={s.word} i={i} className="lg:min-w-0" style={{ flexGrow: raw[i] / sum, flexBasis: 0 }}>
            <div className={cx("flex min-h-[88px] items-start p-5 lg:h-[140px]", s.cls)}>
              <p className="text-[22px] font-medium leading-tight tracking-[-0.02em] lg:text-[clamp(18px,1.6vw,26px)]">{s.time}</p>
            </div>
            <p className="mt-3 max-w-[24ch] pb-4 text-[16px] leading-[1.45] lg:pb-0 lg:text-[17px]">{s.clause}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
