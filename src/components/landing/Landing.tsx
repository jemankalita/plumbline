"use client";

import { LayoutGroup, motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cx } from "../ui";
import { EASE, type BoardRow, type LandingData, type ReplayRun } from "./data";
import { Closing, Panel, Playground } from "./LandingParts";
import { Figure, type Look } from "./Figure";
import { Marquee, Parallax, ScrollProgress, SiteNav, WordsReveal } from "./Motion";
import { PlumbArt } from "./Plates";
import { PhotoCheck } from "./PhotoCheck";
import { ReelCheck } from "./ReelCheck";
import { Replay } from "./Replay";
import { UserTests } from "./UserTests";

export function Landing(data: LandingData) {
  return (
    <div id="top" className="landing overflow-x-clip bg-white">
      <ScrollProgress />
      <SiteNav links={NAV} />
      <Masthead run={data.replay} />
      <Marquee items={CHECKS} className="on-soot border-t border-white/10 bg-soot py-5 text-[15px] text-ash-300 lg:text-[17px]" />
      <Board rows={data.board} checked={data.checked} ms={data.boardMs} />
      <Stages />
      <Panel />
      <Playground aiOn={data.aiOn} />
      <PhotoCheck aiOn={data.aiOn} />
      <ReelCheck />
      <UserTests />
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

/** What the engine checks, for the strip under the masthead. */
const CHECKS = [
  "Banned brand terms",
  "Claims against approved facts",
  "Sentence length",
  "Tone of voice",
  "Inclusive language",
  "Palette match",
  "Logo proportions and clear space",
  "WCAG contrast",
  "Alt text",
  "Words on screen in a Reel",
  "Legal disclaimers",
];

// ---------- masthead: the headline, then the product working ----------

const NAV = [
  { href: "#board", label: "Live check" },
  { href: "#how", label: "How it works" },
  { href: "#try", label: "Try it" },
  { href: "#photos", label: "Photos and Reels" },
  { href: "#tested", label: "Tested" },
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
      <Parallax distance={60} className="grid gap-6 px-[var(--margin)] pb-10 pt-12 lg:grid-cols-12 lg:items-end lg:gap-8 lg:pb-14 lg:pt-20">
        <h1 className="display text-[44px] sm:text-[60px] lg:col-span-7 lg:text-[clamp(60px,6.2vw,96px)]">
          {line("On brand", 0)}
          {line("before it ships.", 1)}
        </h1>
        <motion.div {...after(0)} className="lg:col-span-5 lg:pb-2">
          <p className="max-w-[46ch] text-[17px] leading-[1.55] text-white lg:text-[18px]">
            Plumbline reads captions, emails and banners against your own brand rules and approved facts. Every finding cites the rule it breaks, and a person makes the call.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/new" className="shine lift inline-flex h-11 items-center rounded-lg bg-lime px-5 text-[15px] font-medium text-soot hover:bg-lime-600">
              Check a draft
            </Link>
            <a href="#try" className="text-[15px] font-medium text-white underline decoration-ash-500 underline-offset-4 hover:decoration-lime">
              Try one here first
            </a>
          </div>
        </motion.div>
      </Parallax>

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
        <WordsReveal className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]" text="A live check" />
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
                <motion.li
                  layout
                  key={r.id}
                  initial={{ opacity: 0, x: -24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.35, ease: EASE, opacity: { duration: 0.5, delay: i * 0.05 }, x: { duration: 0.6, delay: i * 0.05, ease: EASE } }}
                  className={cx(isOpen ? "bg-lime text-soot" : "bg-soot-2 text-white")}>
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

const STAGES: { word: string; who: string; look: Look | null; time: string; weight: number; cls: string; clause: string }[] = [
  { word: "First", who: "Creator", look: { hair: "wavy", wear: "kurta", props: ["phone"] }, time: "Two minutes", weight: 120, cls: "bg-ash-200 text-soot", clause: "Pastes the draft and locks the message that must survive." },
  { word: "Then", who: "Plumbline", look: null, time: "Seconds", weight: 20, cls: "bg-lime text-soot", clause: "Rules, claims, AI and a verifier read it." },
  { word: "Next", who: "Reviewer", look: { hair: "bun", wear: "shirt", props: ["glasses", "magnifier"] }, time: "Ten minutes", weight: 600, cls: "bg-soot-3 text-white", clause: "Accepts or disputes each fix. Version 2 is checked again." },
  { word: "Last", who: "Approver", look: { hair: "short", wear: "kurta", props: ["stamp"] }, time: "Same day", weight: 14400, cls: "bg-soot text-white", clause: "Clears the claims and signs it off." },
];

function Stages() {
  const reduce = useReducedMotion();
  const total = STAGES.reduce((s, x) => s + x.weight, 0);
  // True proportions. The machine stage is far under 1%, so it gets a hairline floor and a callout.
  const share = STAGES.map((s) => (s.weight / total) * 100);
  const machineAt = share[0];
  return (
    <section id="how" className="scroll-mt-4 bg-white px-[var(--margin)] py-[clamp(72px,8vw,128px)] text-soot">
      <Reveal>
        <WordsReveal className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]" text="The machine part is a sliver" />
        <p className="mt-4 max-w-[56ch] text-[17px] leading-[1.55] text-muted lg:text-[18px]">
          Drawn to scale: most of the time goes to people making decisions. The timings are illustrative, not measurements.
        </p>
      </Reveal>

      <div data-ui className="relative mt-14">
        <p className="absolute -top-8 flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-soot" style={{ left: `${machineAt}%` }}>
          <span className="block h-4 w-px bg-soot" aria-hidden />
          Plumbline&apos;s check: seconds
        </p>
        <div className="flex h-16 w-full overflow-hidden rounded-xl ring-1 ring-black/5 lg:h-20" role="img" aria-label="Time per stage, drawn to scale: two minutes, seconds, ten minutes, same day">
          {STAGES.map((s, i) => (
            <motion.span
              key={s.word}
              className={cx("block h-full origin-left", s.cls, i > 0 && "border-l border-white/60")}
              style={{ width: `${share[i]}%`, minWidth: s.weight === 20 ? 6 : undefined }}
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.9, delay: 0.15 + i * 0.12, ease: EASE }}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s, i) => (
          <Reveal key={s.word} i={i} className="h-full">
            <div className={cx("flex h-full flex-col overflow-hidden rounded-[24px]", s.weight === 20 ? "bg-lime" : "bg-ash-50")}>
              <div className="grid h-44 place-items-end justify-center overflow-hidden bg-soot pt-4">
                {s.look ? <Figure look={s.look} className="h-40 w-auto" /> : <PlumbArt className="mb-4 h-32 w-32" />}
              </div>
              <div className="flex flex-col gap-2 p-5">
                <span className="flex items-baseline justify-between gap-3 font-sans">
                  <span className="text-[20px] font-semibold tracking-[-0.02em]">{s.who}</span>
                  <span className="text-[15px] text-muted">{s.time}</span>
                </span>
                <span className="text-[17px] leading-[1.45]">{s.clause}</span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
