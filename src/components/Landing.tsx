"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, BookOpen, CalendarClock, Check, Code2, Eye, Lock, ScanSearch, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FindingRow, ReviewResult } from "@/lib/types";
import { DraftView } from "./DraftView";
import { api, Button, cx, ErrorNote, Logo, ScoreRing, SeverityBadge } from "./ui";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Landing({ aiOn }: { aiOn: boolean }) {
  return (
    <div className="overflow-x-clip">
      <Nav />
      <Hero />
      <Pipeline />
      <Playground aiOn={aiOn} />
      <Different />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-sky-25/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav className="ml-auto hidden items-center gap-6 text-sm text-ink md:flex">
          <a href="#how" className="hover:text-navy">How it works</a>
          <a href="#try" className="hover:text-navy">Try it</a>
          <a href="#different" className="hover:text-navy">Why it&apos;s different</a>
        </nav>
        <Link
          href="/queue"
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-navy px-3.5 text-sm font-medium text-white transition-[transform,background-color] hover:bg-sky-700 active:scale-[0.97] md:ml-0"
        >
          Open workspace <ArrowRight className="size-4" />
        </Link>
      </div>
    </header>
  );
}

// ---------- hero ----------

function Plumb() {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 60 420"
      className="pointer-events-none absolute -top-2 left-[6%] hidden h-[420px] w-[60px] origin-top lg:block"
      aria-hidden
      initial={{ rotate: reduce ? 0 : 9 }}
      animate={{ rotate: 0 }}
      transition={{ type: "spring", stiffness: 18, damping: 2.2, mass: 1.4 }}
      style={{ transformOrigin: "30px 0px" }}
    >
      <line x1="30" y1="0" x2="30" y2="360" stroke="var(--color-navy)" strokeWidth="1" />
      <path d="M30 356 L44 384 L30 414 L16 384 Z" fill="var(--color-sky-600)" />
      <path d="M30 356 L44 384 L30 384 Z" fill="var(--color-sky-400)" />
    </motion.svg>
  );
}

const DEMO_TEXT = "This Diwali, get the fastest delivery in India with Quick-Kart! Over 2 lakh happy customers trust us. Shop now, guys!!!";
const DEMO_MARKS = [
  { q: "fastest delivery in India", s: "blocker" as const, label: "Unsupported claim", why: "No approved fact · Rule 4.2", fix: "fast delivery across 40+ cities" },
  { q: "Quick-Kart", s: "warning" as const, label: "Terminology", why: "Term · QuickKart", fix: "QuickKart" },
  { q: "2 lakh", s: "warning" as const, label: "Contradicted", why: "Fact F2 · CRM, Sep 2026", fix: "3.1 lakh" },
  { q: "guys", s: "suggestion" as const, label: "Tone", why: "Rule 1.3", fix: "everyone" },
];

function Hero() {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? DEMO_MARKS.length : 0);
  useEffect(() => {
    if (reduce) return;
    const timers = DEMO_MARKS.map((_, i) => setTimeout(() => setShown(i + 1), 900 + i * 650));
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const weights = { blocker: 18, warning: 7, suggestion: 2 };
  const score = 100 - DEMO_MARKS.slice(0, shown).reduce((s, m) => s + weights[m.s], 0);

  const parts: React.ReactNode[] = [];
  let rest = DEMO_TEXT;
  let key = 0;
  const ordered = [...DEMO_MARKS].sort((a, b) => DEMO_TEXT.indexOf(a.q) - DEMO_TEXT.indexOf(b.q));
  for (const m of ordered) {
    const i = rest.indexOf(m.q);
    parts.push(<span key={key++}>{rest.slice(0, i)}</span>);
    const on = DEMO_MARKS.indexOf(m) < shown;
    parts.push(
      <span key={key++} className={cx("hl transition-[background-color,box-shadow] duration-500", on ? `hl-${m.s}` : "")}>
        {m.q}
      </span>
    );
    rest = rest.slice(i + m.q.length);
  }
  parts.push(<span key={key++}>{rest}</span>);

  return (
    <section className="relative">
      <div className="grid-paper absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" aria-hidden />
      <Plumb />
      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-24">
        <div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="kicker">
            Brand governance · before you hit publish
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease: EASE }}
            className="mt-4 font-serif text-[52px] leading-[0.95] tracking-[-0.02em] text-navy sm:text-[72px] lg:text-[84px]"
          >
            Catch the crooked brick <em className="text-sky-600">before</em> it goes up.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
            className="mt-6 max-w-[520px] text-lg leading-relaxed text-ink"
          >
            Plumbline checks every caption, email and banner against your brand guidelines and your approved facts. Each finding cites the exact rule it breaks and offers a fix
            that keeps what you meant. A person always makes the call.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25, ease: EASE }} className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/new"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-navy px-5 text-[15px] font-medium text-white shadow-[0_10px_24px_-12px_rgb(13_34_54/0.7)] transition-[transform,background-color] hover:bg-sky-700 active:scale-[0.97]"
            >
              Check a draft <ArrowRight className="size-4" />
            </Link>
            <a href="#try" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-white px-5 text-[15px] font-medium text-navy transition-colors hover:border-sky-300">
              Try it without signing in
            </a>
          </motion.div>
          <p className="mt-6 text-xs text-muted">Demo workspace uses a fictional brand, “QuickKart”. Switch between Creator, Reviewer, Approver and Admin from the top bar.</p>
        </div>

        <motion.div initial={{ opacity: 0, y: 24, rotate: 1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.9, delay: 0.2, ease: EASE }} className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-sky-100 via-sky-50 to-transparent blur-2xl" aria-hidden />
          <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-lift">
            <div className="flex items-center gap-3 border-b border-hair bg-sky-50/70 px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden>
                <span className="size-2.5 rounded-full bg-sky-200" />
                <span className="size-2.5 rounded-full bg-sky-200" />
                <span className="size-2.5 rounded-full bg-sky-200" />
              </span>
              <span className="truncate text-xs text-muted">Diwali offer · Instagram caption · v1</span>
              <span className="ml-auto">
                <ScoreRing score={score} size={40} stroke={4} />
              </span>
            </div>
            <p className="px-5 py-5 font-serif text-[23px] leading-[1.55] text-navy sm:text-[26px]">{parts}</p>
            <div className="grid gap-2 border-t border-hair bg-sky-25 p-3">
              <AnimatePresence initial={false}>
                {DEMO_MARKS.slice(0, shown).map((m) => (
                  <motion.div
                    key={m.q}
                    layout
                    initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-white px-3 py-2 text-[13px]"
                  >
                    <SeverityBadge s={m.s} />
                    <span className="font-medium text-navy">{m.label}</span>
                    <span className="text-muted">{m.why}</span>
                    <span className="ml-auto text-mint-700">→ {m.fix}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ---------- pipeline ----------

const PASSES = [
  { n: "01", t: "Rules", d: "Terminology, banned phrases, sentence length, alt text, WCAG contrast, palette. Exact and instant.", tag: "deterministic", icon: ScanSearch },
  { n: "02", t: "Claims", d: "Every number and superlative is checked against your approved facts, which have owners and expiry dates.", tag: "deterministic", icon: CalendarClock },
  { n: "03", t: "Judgement", d: "AI reads tone and messaging against your own voice rules, with personal data masked first.", tag: "AI · optional", icon: Sparkles },
  { n: "04", t: "Verifier", d: "Plain code. If a quoted span or a cited rule doesn't exist, the finding never reaches a person.", tag: "deterministic", icon: ShieldCheck },
];

function Pipeline() {
  return (
    <section id="how" className="border-y border-line bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
        <p className="kicker">How a check works</p>
        <h2 className="mt-3 max-w-2xl font-serif text-[40px] leading-[1.02] tracking-tight text-navy sm:text-5xl">Rules first. AI only where judgement is needed. Then a verifier.</h2>
        <ol className="relative mt-12 grid gap-4 md:grid-cols-4">
          <motion.span
            aria-hidden
            className="absolute left-0 right-0 top-[27px] hidden h-px origin-left bg-sky-300 md:block"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 1.1, ease: EASE }}
          />
          {PASSES.map((p, i) => (
            <motion.li
              key={p.n}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.12, ease: EASE }}
              className="relative"
            >
              <span className={cx("relative grid size-14 place-items-center rounded-2xl border bg-white", p.n === "03" ? "border-sky-400 text-sky-600" : "border-line text-navy")}>
                <p.icon className="size-6" />
              </span>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.14em] text-sky-600">
                {p.n} · {p.tag}
              </p>
              <p className="mt-1 font-serif text-3xl text-navy">{p.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{p.d}</p>
            </motion.li>
          ))}
        </ol>
        <div className="mt-12 grid gap-3 rounded-2xl bg-sky-50 p-5 text-sm text-ink sm:grid-cols-3">
          <p>
            <b className="font-medium text-navy">Blocker</b>: unsupported claim, legal term, failed contrast. Can&apos;t be approved until fixed or overridden with a written reason.
          </p>
          <p>
            <b className="font-medium text-navy">Warning</b>: tone, terminology, outdated fact. Shown with a fix, visible to the approver.
          </p>
          <p>
            <b className="font-medium text-navy">Suggestion</b>: style and readability. Optional, and never blocks anything.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------- playground ----------

const TRY = [
  "Hurry guys!!! Last chance to get India's favourite Diwali sweets from Quick Kart. Order now, it's risk-free!",
  "Groceries at your door in minutes. Free delivery on orders above ₹199, across 40+ cities.",
  "QuickKart is rated 4.6 stars and our delivery boys work round the clock for over 5 lakh customers.",
];

function Playground({ aiOn }: { aiOn: boolean }) {
  const [text, setText] = useState(TRY[0]);
  const [res, setRes] = useState<ReviewResult | null>(null);
  const [checked, setChecked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  async function run(t = text) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<ReviewResult>("/api/review", { body: { text: t } });
      setRes(r);
      setChecked(t);
      setActive(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const rows = (res?.findings ?? []).map((f) => ({ ...f, revisionId: "try", submissionId: "try" })) as FindingRow[];

  return (
    <section id="try" className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Try it · live engine, nothing saved</p>
          <h2 className="mt-3 max-w-xl font-serif text-[40px] leading-[1.02] tracking-tight text-navy sm:text-5xl">Paste something. See exactly what breaks, and why.</h2>
        </div>
        <p className="max-w-sm text-sm text-muted">
          Checked against the demo QuickKart Brand Kit.{" "}
          {aiOn ? "AI judgement is on for tone and messaging." : "AI judgement is off on this server, so you'll see the deterministic passes."}
        </p>
      </div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={5000}
            aria-label="Text to check"
            className="block w-full resize-y px-5 py-4 font-serif text-[22px] leading-[1.55] text-navy outline-none"
          />
          <div className="flex flex-wrap items-center gap-2 border-t border-hair bg-sky-50/60 px-4 py-3">
            {TRY.map((t, i) => (
              <button
                key={i}
                onClick={() => {
                  setText(t);
                  run(t);
                }}
                className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink hover:border-sky-300"
              >
                Example {i + 1}
              </button>
            ))}
            <Button className="ml-auto" variant="primary" loading={busy} icon={<Wand2 className="size-4" />} onClick={() => run()} disabled={!text.trim()}>
              Check it
            </Button>
          </div>
        </div>

        <div className="min-h-[280px] rounded-2xl border border-line bg-white p-5 shadow-soft">
          <ErrorNote error={error} />
          {!res && !busy && !error && (
            <div className="grid h-full min-h-[240px] place-items-center text-center">
              <div>
                <Eye className="mx-auto size-6 text-sky-400" />
                <p className="mt-2 font-serif text-2xl text-navy">Results appear here</p>
                <p className="text-sm text-muted">Highlights, citations and fixes.</p>
              </div>
            </div>
          )}
          {busy && !res && (
            <div className="grid gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-14 rounded-xl" />
              ))}
            </div>
          )}
          {res && (
            <div className={cx("grid gap-4 transition-opacity", busy && "opacity-50")}>
              <div className="flex items-center gap-4">
                <ScoreRing score={res.score} size={56} stroke={5} />
                <p className="text-sm text-ink">
                  <b className="num font-medium text-navy">{res.findings.length}</b> finding{res.findings.length === 1 ? "" : "s"} in{" "}
                  <span className="num">{res.durationMs} ms</span>
                  {res.dropped > 0 && <span className="text-muted"> · {res.dropped} unverifiable AI finding(s) dropped</span>}
                </p>
              </div>
              <div className="rounded-xl bg-sky-25 p-4 text-[18px]">
                <DraftView text={checked} findings={rows} activeId={active} onSelect={setActive} />
              </div>
              <ul className="grid gap-2">
                {rows.map((f) => (
                  <li
                    key={f.id}
                    onMouseEnter={() => setActive(f.id)}
                    className={cx("grid gap-1 rounded-xl border px-3 py-2.5 text-[13px] transition-colors", active === f.id ? "border-navy" : "border-line")}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge s={f.severity} />
                      <span className="font-medium text-navy">“{f.quote}”</span>
                      {f.fix && <span className="ml-auto text-mint-700">→ {f.fix}</span>}
                    </div>
                    <p className="text-ink">{f.message}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <BookOpen className="size-3 text-sky-600" /> {f.cites.label}
                      {f.ai && <span className="text-sky-700">· AI {Math.round(f.confidence * 100)}%</span>}
                    </p>
                  </li>
                ))}
                {rows.length === 0 && (
                  <li className="flex items-center gap-2 rounded-xl bg-mint-50 px-3 py-3 text-sm text-mint-700">
                    <Check className="size-4" /> On brand. Nothing to fix.
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted">AI use: {res.ai.provider ?? "none"}. {res.ai.note}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------- differentiators ----------

const DIFF = [
  { t: "Verification in code", d: "We don't ask the model to explain itself. We reject any finding whose quote or rule doesn't exist.", icon: ShieldCheck },
  { t: "Facts that expire", d: "Claims are checked against your approved facts register, and each fact has an owner and an expiry date. Stale numbers flag themselves.", icon: CalendarClock },
  { t: "The guidelines get reviewed too", d: "When a rule keeps getting overridden, the Gap Finder flags the rule as unclear, not the writer.", icon: Sparkles },
  { t: "Intent lock", d: "Mark the message that must survive. A fix that would drop it is never offered as one click.", icon: Lock },
  { t: "Accessibility on every check", d: "Alt text, WCAG contrast and palette checks run on every image, not as an afterthought.", icon: Eye },
];

function Different() {
  return (
    <section id="different" className="border-t border-line bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-20 sm:px-6">
        <p className="kicker">Why it&apos;s different</p>
        <h2 className="mt-3 max-w-2xl font-serif text-[40px] leading-[1.02] tracking-tight text-navy sm:text-5xl">Every flag says where, why, and according to what.</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {DIFF.map((x, i) => (
            <motion.div
              key={x.t}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="bg-white p-5"
            >
              <x.icon className="size-5 text-sky-600" />
              <p className="mt-4 font-mono text-[11px] text-sky-600">0{i + 1}</p>
              <p className="mt-1 font-medium text-navy">{x.t}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink">{x.d}</p>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-navy px-6 py-8 text-white sm:px-10">
          <p className="max-w-xl font-serif text-[30px] leading-tight sm:text-[36px]">See the whole workflow: submit, fix, verify, approve.</p>
          <Link href="/queue" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-medium text-navy transition-transform active:scale-[0.97]">
            Open the workspace <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-4 px-4 py-8 text-sm text-muted sm:px-6">
        <Logo />
        <span>Built by Team Diet Code · Jeman Kalita &amp; Krishnesha Sarma · problem statement by Inkloom AI</span>
        <a href="https://github.com/jemankalita/plumbline" className="ml-auto inline-flex items-center gap-1.5 hover:text-navy">
          <Code2 className="size-4" /> Source
        </a>
      </div>
    </footer>
  );
}
