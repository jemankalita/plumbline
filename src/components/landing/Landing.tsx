"use client";

import { LayoutGroup, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cx, Logo } from "../ui";
import { EASE, MEDIA, type BoardRow, type LandingData } from "./data";
import { Closing, Names, Panel, Playground } from "./LandingParts";

export function Landing(data: LandingData) {
  return (
    <div className="overflow-x-clip bg-white">
      <Masthead />
      <Board rows={data.board} ms={data.boardMs} />
      <Stages />
      <Panel />
      <Playground aiOn={data.aiOn} />
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

// ---------- masthead ----------

type Img = (typeof MEDIA)[keyof typeof MEDIA];

function Photo({ m, className, priority, contain }: { m: Img; className?: string; priority?: boolean; contain?: boolean }) {
  return (
    <div className={cx("relative overflow-hidden", className)}>
      <Image
        src={m.src}
        alt={m.alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 33vw, 50vw"
        className={contain ? "object-contain p-[8%]" : "object-cover"}
      />
    </div>
  );
}

/** The plumb bob on its string keeps moving, very slightly, the way a real one settles. */
function SwingingPhoto({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cx("relative overflow-hidden bg-[#7a3b2a]", className)}>
      <motion.div
        className="absolute inset-[-6%]"
        style={{ transformOrigin: "50% 0%" }}
        animate={reduce ? undefined : { rotate: [-1.6, 1.6, -1.6] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src={MEDIA.string.src} alt={MEDIA.string.alt} fill priority sizes="(min-width: 1024px) 17vw, 34vw" className="object-cover" />
      </motion.div>
    </div>
  );
}

function MarkFragment() {
  return (
    <div data-ui className="flex h-full flex-col justify-end bg-white p-[clamp(12px,1.4vw,22px)] text-soot">
      <p className="text-[clamp(15px,1.25vw,20px)] leading-[1.45]">
        This Diwali, get the <span className="hl hl-blocker">fastest delivery in India</span> with <span className="hl hl-warning">Quick-Kart</span>!
      </p>
      <p className="mt-3 text-[13px] text-muted">Rule 4.2 · needs an approved fact</p>
    </div>
  );
}

function ScoreFragment() {
  return (
    <div data-ui className="flex h-full flex-col justify-between bg-soot-3 p-[clamp(12px,1.4vw,22px)] text-white">
      <p className="text-[14px] text-ash-300">Brand score, v1</p>
      <p className="num text-[clamp(48px,5vw,84px)] font-semibold leading-none tracking-[-0.05em] text-lime">64</p>
      <p className="text-[14px] text-ash-300">1 blocker · 3 warnings</p>
    </div>
  );
}

function Masthead() {
  const reduce = useReducedMotion();
  const line = (text: string, k: number) => (
    <span className="mask-line" key={k}>
      <motion.span
        initial={reduce ? false : { y: "105%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 0.9, delay: 0.15 + k * 0.11, ease: [0.16, 1, 0.3, 1] }}
      >
        {text}
      </motion.span>
    </span>
  );
  const after = (k: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay: 0.75 + k * 0.08, ease: EASE } };

  return (
    <section className="on-soot bg-soot text-white">
      <div className="relative">
        <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-stretch text-[15px]">
          <div className="flex items-stretch lg:w-[var(--axis)]">
            <Link href="/" className="flex items-center bg-soot px-[var(--margin)]" aria-label="Plumbline home">
              <Logo tone="paper" />
            </Link>
            <nav className="hidden flex-1 items-center gap-7 bg-lime px-6 font-medium text-soot lg:flex" aria-label="Page">
              <a href="#board" className="hover:underline">The check</a>
              <a href="#try" className="hover:underline">Try it</a>
              <a href="https://github.com/jemankalita/plumbline" className="hover:underline">Source</a>
            </nav>
          </div>
          <div className="ml-auto flex items-center bg-soot px-[var(--margin)]">
            <Link href="/queue" className="lift inline-flex h-11 items-center rounded-lg bg-lime px-4 font-medium text-soot hover:bg-lime-600">
              Open the workspace
            </Link>
          </div>
        </header>

        {/* desktop mosaic: 6 × 2, gutterless */}
        <div className="hidden h-[52svh] min-h-[380px] grid-cols-6 grid-rows-2 lg:grid">
          <div className="row-span-2 bg-lime" />
          <Photo m={MEDIA.lacma} priority />
          <Photo m={MEDIA.printing} className="col-span-2" priority />
          <ScoreFragment />
          <Photo m={MEDIA.proof} priority />
          <Photo m={MEDIA.hatshepsut} className="bg-white" contain />
          <SwingingPhoto />
          <div className="col-span-2">
            <MarkFragment />
          </div>
          <div className="bg-soot-2" />
        </div>
        {/* phone mosaic: 3 × 2 */}
        <div className="grid h-[38svh] min-h-[260px] grid-cols-3 grid-rows-2 pt-14 lg:hidden">
          <div className="bg-lime" />
          <Photo m={MEDIA.lacma} priority />
          <ScoreFragment />
          <SwingingPhoto />
          <div className="col-span-2">
            <MarkFragment />
          </div>
        </div>
      </div>

      <div className="px-[var(--margin)] pb-20 pt-10 lg:grid lg:grid-cols-[calc(var(--axis)-var(--margin))_1fr] lg:pb-28 lg:pt-[96px]">
        <h1 className="display text-[13vw] lg:col-start-2 lg:text-[clamp(56px,7.4vw,120px)]">
          {line("On brand", 0)}
          {line("before it ships.", 1)}
        </h1>
        <motion.div {...after(0)} className="mt-8 max-w-[34ch] lg:col-start-1 lg:row-start-1 lg:mt-0 lg:self-end lg:pb-3">
          <p className="text-[17px] leading-[1.5] text-white lg:text-[20px]">
            Plumbline reads captions, emails and banners against your own brand rules and approved facts. Every mark cites the rule it breaks, and a person makes the call.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/new" className="lift inline-flex h-12 items-center rounded-lg bg-lime px-5 text-[16px] font-medium text-soot hover:bg-lime-600">
              Check a draft
            </Link>
            <a href="#try" className="text-[16px] font-medium text-white underline decoration-ash-500 underline-offset-4 hover:decoration-lime">
              Try one here first
            </a>
          </div>
        </motion.div>
      </div>
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

function Board({ rows, ms }: { rows: BoardRow[]; ms: number }) {
  const [open, setOpen] = useState(Math.min(3, rows.length - 1));
  const drafts = new Set(rows.map((r) => r.draft)).size;
  return (
    <section id="board" className="on-soot bg-soot pb-10 text-white lg:pb-16">
      <Reveal className="px-[var(--margin)] pb-12 pt-6 lg:pl-[var(--axis)] lg:pt-10">
        <p className="max-w-[44ch] text-[20px] leading-[1.45] text-white lg:text-[24px]">
          This is a real check. The engine read {drafts} QuickKart drafts while this page loaded and found {rows.length} things to fix, in{" "}
          <span className="num">{ms}</span> ms. Pick any row.
        </p>
      </Reveal>
      <div className="relative overflow-hidden px-2 lg:px-3">
        <LayoutGroup>
          <ul data-ui className="-my-[32px] grid gap-1 lg:-my-[36px]" aria-label="Findings from the live check">
            {rows.map((r, i) => {
              const isOpen = i === open;
              return (
                <motion.li layout key={r.id} transition={{ duration: 0.35, ease: EASE }} className={cx(isOpen ? "bg-lime text-soot" : "bg-soot-2 text-white")}>
                  <button
                    onClick={() => setOpen(i)}
                    aria-expanded={isOpen}
                    className={cx(
                      "grid w-full grid-cols-[1fr_auto] items-center gap-x-4 px-3 text-left transition-colors lg:grid-cols-12 lg:px-5",
                      isOpen ? "h-[200px] content-center lg:h-[216px]" : "h-16 hover:bg-soot-3 lg:h-[72px]"
                    )}
                  >
                    <span className={cx("truncate font-medium tracking-[-0.02em]", isOpen ? "text-[24px] lg:text-[40px]" : "text-[20px] lg:text-[28px]", "lg:col-span-5")}>
                      “{r.quote}”
                    </span>
                    <span className="hidden truncate text-[22px] lg:col-span-2 lg:block">{r.cite}</span>
                    <span className="hidden truncate text-[22px] lg:col-span-2 lg:block">{r.pass}</span>
                    <span className="hidden truncate text-[22px] lg:col-span-2 lg:block">{r.draft}</span>
                    <span className={cx("justify-self-end whitespace-nowrap rounded-md px-2.5 py-1 text-[15px] font-medium lg:col-span-1 lg:text-[17px]", STATUS_BLOCK[r.severity])}>
                      {STATUS_WORD[r.severity]}
                    </span>
                    {isOpen && (
                      <motion.span
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
                        className="col-span-2 mt-3 grid max-w-[78ch] gap-1 text-[16px] leading-[1.45] lg:col-span-12 lg:text-[17px]"
                      >
                        <span>
                          {r.message} <span className="lg:hidden">({r.cite} · {r.draft})</span>
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
    <section id="how" className="bg-white px-[var(--margin)] py-[clamp(96px,12vw,200px)] text-soot">
      <Reveal>
        <h2 className="display max-w-[16ch] text-[11vw] lg:text-[clamp(48px,6.4vw,104px)]">The machine part is a sliver</h2>
      </Reveal>
      <div data-ui className="mt-16 grid gap-1.5 lg:flex lg:gap-1.5">
        {STAGES.map((s, i) => (
          <Reveal key={s.word} i={i} className="lg:min-w-0" style={{ flexGrow: raw[i] / sum, flexBasis: 0 }}>
            <div className={cx("flex min-h-[88px] items-start p-5 lg:h-[22vh] lg:min-h-[160px]", s.cls)}>
              <p className="text-[22px] font-medium leading-tight tracking-[-0.02em] lg:text-[clamp(18px,1.6vw,26px)]">{s.time}</p>
            </div>
            <p className="mt-3 max-w-[24ch] pb-4 text-[16px] leading-[1.45] lg:pb-0 lg:text-[17px]">{s.clause}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
