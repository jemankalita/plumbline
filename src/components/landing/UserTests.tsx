"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { USER_FIXES, USER_LESSONS, USER_TEST_LIMIT, USER_TESTERS, type UserTester } from "@/lib/user-tests";
import { cx, NumberTicker } from "../ui";
import { EASE } from "./data";
import { Figure, type Look } from "./Figure";
import { WordsReveal } from "./Motion";

/** At most this many problems per person are shown in full; the rest are counted. */
const SHOWN_PER_PERSON = 3;
const STEP_S = 0.8;
const TYPING_MS = 550;
/** How each tester is drawn: props from their work, not their likeness. */
const LOOKS: Record<string, Look> = {
  Lakshya: { hair: "short", wear: "hoodie", props: ["glasses"] },
  Tushar: { hair: "wavy", wear: "shirt", props: ["phone"] },
  Amber: { hair: "long", wear: "tee", props: ["earrings", "stole"] },
  Naitik: { hair: "curly", wear: "tee", props: ["headphones"] },
};
const FALLBACK_LOOK: Look = { hair: "short", wear: "tee", props: [] };
const lookOf = (name: string) => LOOKS[name] ?? FALLBACK_LOOK;
const SANS = "font-[family-name:var(--font-sans)]";

const fixesBy = (name: string) => USER_FIXES.filter((f) => f.foundBy === name);

/**
 * "Tested by real people", told as conversations. Each tester arrives as the reader scrolls,
 * says what went wrong in their own bubble, and Plumbline answers with what changed.
 */
export function UserTests() {
  const [seen, setSeen] = useState<ReadonlySet<string>>(new Set());
  const met = USER_TESTERS.filter((t) => seen.has(t.name));
  const found = met.reduce((n, t) => n + fixesBy(t.name).length, 0);
  const counters = [
    { n: met.length, label: "people", cls: "bg-white" },
    { n: found, label: "problems found", cls: "bg-white" },
    { n: found, label: "fixed", cls: "bg-lime" },
  ];

  return (
    <section id="tested" className="scroll-mt-16 bg-ash-50 px-[var(--margin)] pb-[clamp(72px,8vw,128px)] text-soot">
      <Lineup />
      <div className="mt-[clamp(56px,6vw,96px)] grid gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:sticky lg:top-28 lg:col-span-4 lg:self-start">
          <WordsReveal className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]" text="Tested by real people" />
          <p className="mt-4 max-w-[34ch] text-[18px] leading-[1.5]">Four people from marketing and content work. Here is what they ran into.</p>

          <dl className="mt-8 grid grid-cols-3 gap-1.5">
            {counters.map((c) => (
              <div key={c.label} className={cx("grid p-4", c.cls)}>
                <dt className={cx(SANS, "order-last mt-1.5 text-[14px] leading-tight")}>{c.label}</dt>
                <dd className={cx(SANS, "-order-1 text-[40px] font-semibold leading-none tracking-[-0.03em]")}>
                  <NumberTicker value={c.n} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[15px] leading-[1.45] text-muted">The counts climb as you meet each person.</p>
        </div>

        <ol className="grid gap-16 lg:col-span-7 lg:col-start-6 lg:gap-24" aria-label="What each tester found">
          {USER_TESTERS.map((t) => (
            <Thread key={t.name} tester={t} onMeet={() => setSeen((s) => (s.has(t.name) ? s : new Set(s).add(t.name)))} />
          ))}
        </ol>
      </div>

      <div className="mt-20 lg:mt-28">
        <p className={cx(SANS, "text-[20px] font-semibold tracking-[-0.02em]")}>What it taught us</p>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {USER_LESSONS.map((l) => (
            <li key={l.title} title={l.body} className={cx(SANS, "bg-soot px-4 py-2.5 text-[16px] text-white")}>
              {l.title}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-[68ch] text-[15px] leading-[1.5] text-muted">{USER_TEST_LIMIT}</p>
      </div>
    </section>
  );
}

/** The four testers stand side by side and rise into place one after another, like a group photo. */
function Lineup() {
  const reduce = !!useReducedMotion();
  return (
    <motion.div
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.4 }}
      className="-mx-[var(--margin)] overflow-hidden rounded-b-[48px] bg-soot px-[var(--margin)] pt-14 lg:rounded-b-[80px] lg:pt-20"
    >
      <ul className="mx-auto flex max-w-[1100px] items-end justify-center">
        {USER_TESTERS.map((t, i) => (
          <motion.li
            key={t.name}
            className={cx("relative w-1/4 max-w-[260px]", i > 0 && "-ml-[4%]")}
            style={{ zIndex: i % 2 ? 1 : 2 }}
            variants={reduce ? undefined : { hidden: { y: "45%", opacity: 0 }, shown: { y: "0%", opacity: 1, transition: { duration: 0.8, delay: 0.15 + i * 0.22, ease: EASE } } }}
          >
            <Figure look={lookOf(t.name)} className="block w-full" />
            <span className={cx(SANS, "absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-lime px-2.5 py-1 text-[13px] font-medium text-soot sm:text-[15px]")}>{t.name}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

function Thread({ tester, onMeet }: { tester: UserTester; onMeet: () => void }) {
  const reduce = !!useReducedMotion();
  const fixes = fixesBy(tester.name);
  const shown = fixes.slice(0, SHOWN_PER_PERSON);
  const more = fixes.length - shown.length;
  // Someone with nothing to report shows what held up instead.
  const held = fixes.length === 0 ? tester.worked.slice(0, 3) : [];
  let k = 0;
  const at = () => (reduce ? 0 : 0.4 + STEP_S * k++);

  return (
    <motion.li initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.3 }} onViewportEnter={onMeet} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
      <motion.span
        aria-hidden
        variants={reduce ? undefined : { hidden: { scale: 0.4, opacity: 0 }, shown: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 260, damping: 18 } } }}
        className="row-span-2 grid size-16 place-items-center overflow-hidden rounded-full bg-soot"
      >
        <Figure look={lookOf(tester.name)} crop="head" className="size-full" />
      </motion.span>
      <motion.div variants={fade(reduce, 0.1)} className="self-end">
        <p className={cx(SANS, "text-[20px] font-semibold leading-tight tracking-[-0.02em]")}>{tester.name}</p>
        <p className="text-[15px] text-muted">{tester.role}</p>
      </motion.div>

      <div className="col-span-2 grid gap-2.5 sm:col-span-1 sm:col-start-2">
        {shown.map((f) => (
          <div key={f.problem} className="grid gap-2.5">
            <Bubble delay={at()} reduce={reduce} side="them">
              {f.problem}
            </Bubble>
            <Bubble delay={at()} reduce={reduce} side="us">
              <Check className="mr-1.5 inline size-4 -translate-y-px" aria-hidden />
              <b className="font-semibold">Fixed.</b> {f.change}
            </Bubble>
          </div>
        ))}
        {more > 0 && (
          <motion.p variants={fade(reduce, at())} className={cx(SANS, "justify-self-end text-[14px] text-muted")}>
            and {more} more fixed
          </motion.p>
        )}
        {held.map((w) => (
          <Bubble key={w} delay={at()} reduce={reduce} side="held">
            <Check className="mr-1.5 inline size-4 -translate-y-px text-lime" aria-hidden />
            {w}
          </Bubble>
        ))}
      </div>
    </motion.li>
  );
}

function fade(reduce: boolean, delay: number) {
  return reduce ? undefined : { hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: EASE } } };
}

const SIDE = {
  them: "justify-self-start rounded-[20px] rounded-tl-md bg-white text-soot",
  us: "justify-self-end rounded-[20px] rounded-tr-md bg-lime text-soot",
  held: "justify-self-start rounded-[20px] rounded-tl-md bg-soot text-white",
} as const;

/** A chat bubble. Tester bubbles show "typing" dots for a moment, so each person seems to speak. */
function Bubble({ side, delay, reduce, children }: { side: keyof typeof SIDE; delay: number; reduce: boolean; children: React.ReactNode }) {
  const [arrived, setArrived] = useState(false);
  const [typed, setTyped] = useState(reduce || side !== "them");
  useEffect(() => {
    if (!arrived || typed) return;
    const t = setTimeout(() => setTyped(true), TYPING_MS);
    return () => clearTimeout(t);
  }, [arrived, typed]);

  return (
    <motion.div
      variants={reduce ? undefined : { hidden: { opacity: 0, y: 14, scale: 0.96 }, shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, delay, ease: EASE } } }}
      onAnimationComplete={() => setArrived(true)}
      style={{ transformOrigin: side === "us" ? "100% 100%" : "0% 100%" }}
      className={cx(SANS, "max-w-[88%] px-4 py-3 text-[16px] sm:max-w-[34rem] leading-[1.45]", SIDE[side])}
    >
      <AnimatePresence mode="wait" initial={false}>
        {typed ? (
          <motion.span key="text" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="block">
            {children}
          </motion.span>
        ) : (
          <motion.span key="dots" exit={{ opacity: 0 }} className="flex gap-1 py-2" role="status" aria-label="typing">
            {[0, 1, 2].map((d) => (
              <motion.span key={d} className="size-1.5 rounded-full bg-ash-400" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.12 }} />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
