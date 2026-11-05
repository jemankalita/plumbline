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

function DraftFragment() {
  return (
    <div data-ui className="flex h-full flex-col bg-white p-[clamp(16px,2vw,32px)] text-soot">
      <p className="text-[14px] font-medium text-muted">Diwali offer · Instagram caption · v1</p>
      <p className="mt-auto text-[clamp(20px,2vw,30px)] leading-[1.45] tracking-[-0.01em]">
        This Diwali, get the <span className="hl hl-blocker">fastest delivery in India</span> with <span className="hl hl-warning">Quick-Kart</span>! Over{" "}
        <span className="hl hl-warning">2 lakh</span> happy customers trust us. Shop now, <span className="hl hl-suggestion">guys</span>!!!
      </p>
    </div>
  );
}

function ScoreFragment() {
  return (
    <div data-ui className="flex h-full items-end justify-between gap-4 bg-soot-3 p-[clamp(16px,1.6vw,24px)] text-white">
      <div>
        <p className="text-[15px] text-ash-300">Brand score</p>
        <p className="text-[15px] text-white">1 blocker · 3 warnings</p>
      </div>
      <p className="num text-[clamp(56px,5.4vw,92px)] font-semibold leading-[0.85] tracking-[-0.05em] text-lime">64</p>
    </div>
  );
}

const HERO_FINDINGS = [
  { s: "Blocker", cls: "bg-red text-white", q: "fastest delivery in India", why: "No approved fact · Rule 4.2" },
  { s: "Warning", cls: "bg-amber text-soot", q: "Quick-Kart", why: "Write it as QuickKart" },
  { s: "Warning", cls: "bg-amber text-soot", q: "2 lakh", why: "Approved figure is 3.1 lakh · Fact F2" },
];

function FindingsFragment() {
  return (
    <div data-ui className="flex h-full flex-col justify-end gap-1 bg-lime p-[clamp(12px,1.2vw,18px)] text-soot">
      {HERO_FINDINGS.map((f) => (
        <div key={f.q} className="grid grid-cols-[auto_1fr] items-center gap-x-3 bg-white px-3 py-2">
          <span className={cx("rounded-md px-2 py-0.5 text-[13px] font-medium", f.cls)}>{f.s}</span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-medium">“{f.q}”</span>
            <span className="block truncate text-[13px]">{f.why}</span>
          </span>
        </div>
      ))}
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

        {/* desktop band: one photograph, the rest is the product itself */}
        <div className="hidden h-[54svh] min-h-[420px] grid-cols-6 grid-rows-2 pt-14 lg:grid">
          <SwingingPhoto className="row-span-2" />
          <div className="col-span-3 row-span-2">
            <DraftFragment />
          </div>
          <div className="col-span-2">
            <ScoreFragment />
          </div>
          <div className="col-span-2">
            <FindingsFragment />
          </div>
        </div>
        {/* phone band */}
        <div className="grid h-[42svh] min-h-[300px] grid-cols-3 grid-rows-[1fr_auto] pt-14 lg:hidden">
          <SwingingPhoto className="row-span-2" />
          <div className="col-span-2">
            <DraftFragment />
          </div>
          <div className="col-span-2 h-[96px]">
            <ScoreFragment />
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
      <Reveal className="px-[var(--margin)] pb-12 pt-16 lg:pl-[var(--axis)] lg:pt-24">
        <h2 className="display text-[11vw] lg:text-[clamp(44px,5.6vw,88px)]">A live check</h2>
        <p className="mt-6 max-w-[48ch] text-[18px] leading-[1.5] text-white lg:text-[20px]">
          The engine read {drafts} QuickKart drafts while this page loaded and found {rows.length} things to fix, in <span className="num">{ms}</span> ms. Pick any
          row to see why.
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
                    <span className={cx("truncate font-medium tracking-[-0.02em]", isOpen ? "text-[24px] lg:text-[36px]" : "text-[19px] lg:text-[24px]", "lg:col-span-5")}>
                      “{r.quote}”
                    </span>
                    <span className={cx("hidden truncate text-[18px] lg:col-span-5 lg:block", isOpen ? "text-soot" : "text-ash-300")}>
                      <span className={isOpen ? "font-medium" : "font-medium text-white"}>{r.cite}</span> · {r.title}
                    </span>
                    <span className={cx("justify-self-end whitespace-nowrap rounded-md px-2.5 py-1 text-[15px] font-medium lg:col-span-2 lg:text-[16px]", STATUS_BLOCK[r.severity])}>
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
