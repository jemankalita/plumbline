"use client";

import Link from "next/link";
import { useState } from "react";
import type { FindingRow, ReviewResult } from "@/lib/types";
import { DraftView } from "../DraftView";
import { api, Button, cx, ErrorNote, Logo, ScoreRing, SeverityBadge } from "../ui";
import type { KitColumn } from "./data";
import { Reveal } from "./Landing";

// ---------- one finding, shown whole like a plate in a manual ----------

type Part = "quote" | "rule" | "fact" | "fix" | "decide" | "disclose";

const NOTES: { part: Part; side: "left" | "right"; top: number; name: string; text: string }[] = [
  { part: "quote", side: "left", top: 96, name: "The exact words", text: "Every mark quotes the span it is about. If the quote isn't in the draft, the verifier throws it out." },
  { part: "rule", side: "right", top: 196, name: "The rule it breaks", text: "A finding must cite one real rule, term or fact. The database refuses a row that doesn't." },
  { part: "fact", side: "left", top: 316, name: "The approved fact", text: "Numbers and superlatives are checked against a facts register. Each fact has an owner and an expiry date." },
  { part: "fix", side: "right", top: 436, name: "A fix that keeps the point", text: "Fixes change as little as they can. One that would drop the locked key message is never one click." },
  { part: "decide", side: "left", top: 556, name: "A person decides", text: "Accept, dispute or dismiss. Blockers can only be overridden by an approver, with a written reason." },
  { part: "disclose", side: "right", top: 640, name: "Which pass found it", text: "Each check says whether AI was used, by which model, and how many AI findings the verifier dropped." },
];

function PanelPart({ part, active, className, children }: { part: Part; active: Part | null; className?: string; children: React.ReactNode }) {
  return (
    <div
      data-part={part}
      className={cx("absolute inset-x-0 px-5 transition-[background-color] duration-200", active === part ? "bg-lime" : "bg-transparent", className)}
    >
      {children}
    </div>
  );
}

export function Panel() {
  const [active, setActive] = useState<Part | null>(null);
  const [decision, setDecision] = useState<"open" | "accepted" | "disputed">("open");
  const note = (n: (typeof NOTES)[number], i: number) => (
    <Reveal
      key={n.part}
      i={i}
      className={cx("max-w-[26ch] lg:absolute", n.side === "left" ? "lg:right-0 lg:text-right" : "lg:left-0")}
      style={{ top: n.top }}
    >
      <button
        className={cx("text-left", n.side === "left" && "lg:text-right")}
        onMouseEnter={() => setActive(n.part)}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(n.part)}
        onBlur={() => setActive(null)}
      >
        <span className={cx("block text-[18px] font-medium underline-offset-4", active === n.part && "underline decoration-2")}>{n.name}</span>
        <span className="mt-1 block text-[16px] leading-[1.45] text-soot">{n.text}</span>
      </button>
    </Reveal>
  );

  return (
    <section className="bg-ash-50 px-[var(--margin)] py-[clamp(72px,8vw,128px)] text-soot">
      <div className="grid gap-10 lg:grid-cols-[1fr_400px_1fr] lg:gap-12">
        <div className="relative lg:h-[720px]">
          <Reveal>
            <h2 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] lg:ml-auto lg:max-w-[14ch] lg:text-right lg:text-[38px]">Every mark shows its working</h2>
          </Reveal>
          <div className="hidden lg:block">{NOTES.filter((n) => n.side === "left").map(note)}</div>
        </div>

        <Reveal className="relative">
          <div data-ui className="relative mx-auto h-[700px] w-full max-w-[400px] bg-white text-[15px] text-soot">
            <div className="absolute inset-x-0 top-0 flex h-14 items-center justify-between bg-soot px-5 text-white">
              <span className="font-medium">Finding 1</span>
              <SeverityBadge s="blocker" />
            </div>
            <PanelPart part="quote" active={active} className="top-[80px] py-4">
              <p className="text-[13px] text-muted">In the draft</p>
              <p className="mt-1 text-[22px] leading-[1.3] tracking-[-0.02em]">
                “<span className="hl hl-blocker">fastest delivery in India</span>”
              </p>
            </PanelPart>
            <PanelPart part="rule" active={active} className="top-[184px] py-4">
              <p className="text-[13px] text-muted">Rule 4.2 · Claims</p>
              <p className="mt-1 font-medium">Claims need approved evidence</p>
              <p className="mt-1 leading-[1.45] text-muted">Superlatives and numbers must match an approved fact in the facts register.</p>
            </PanelPart>
            <PanelPart part="fact" active={active} className="top-[304px] py-4">
              <p className="text-[13px] text-muted">Nearest approved fact</p>
              <p className="mt-1 font-medium">F1 · fast delivery across 40+ cities</p>
              <p className="mt-1 text-muted">Operations team · expires 31 Mar 2027</p>
            </PanelPart>
            <PanelPart part="fix" active={active} className="top-[424px] py-4">
              <p className="text-[13px] text-muted">Suggested fix</p>
              <p className="mt-1 text-[18px]">
                <span className="line-through decoration-red decoration-2">fastest delivery in India</span>{" "}
                <span className="bg-green-50 px-0.5 text-green-700">fast delivery across 40+ cities</span>
              </p>
              <p className="mt-1 text-muted">Keeps the locked message: “Diwali delivery”.</p>
            </PanelPart>
            <PanelPart part="decide" active={active} className="top-[548px] flex flex-wrap items-center gap-2 py-4">
              <Button size="sm" variant="primary" onClick={() => setDecision("accepted")} aria-pressed={decision === "accepted"}>
                {decision === "accepted" ? "Fix accepted" : "Accept fix"}
              </Button>
              <Button size="sm" onClick={() => setDecision("disputed")} aria-pressed={decision === "disputed"}>
                {decision === "disputed" ? "Disputed" : "Dispute"}
              </Button>
              <Button size="sm" variant="ghost" disabled title="Blockers can't be dismissed">
                Dismiss
              </Button>
            </PanelPart>
            <PanelPart part="disclose" active={active} className="top-[628px] py-4 text-muted">
              Found by the claims pass. No AI used. Verifier: passed.
            </PanelPart>
          </div>
        </Reveal>

        <div className="relative lg:h-[720px]">
          <div className="hidden lg:block">{NOTES.filter((n) => n.side === "right").map(note)}</div>
          <div className="grid gap-6 sm:grid-cols-2 lg:hidden">{NOTES.map(note)}</div>
        </div>
      </div>
    </section>
  );
}

// ---------- the live thing: paste a caption, get it marked ----------

const TRY = [
  "Hurry guys!!! Last chance to get India's favourite Diwali sweets from Quick Kart. Order now, it's risk-free!",
  "Groceries at your door in minutes. Free delivery on orders above ₹199, across 40+ cities.",
  "QuickKart is rated 4.6 stars and our delivery boys work round the clock for over 5 lakh customers.",
];

export function Playground({ aiOn }: { aiOn: boolean }) {
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
    <section id="try" className="scroll-mt-4 bg-lime px-[var(--margin)] py-[clamp(72px,8vw,128px)] text-soot">
      <div>
        <Reveal>
          <h2 className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]">Paste a caption</h2>
          <p className="mt-4 max-w-[56ch] text-[17px] leading-[1.55] lg:text-[18px]">
            It is checked against the demo QuickKart Brand Kit by the same engine the workspace uses. Nothing is saved.{" "}
            {aiOn ? "AI judgement is on for tone and messaging." : "AI judgement is off on this server, so only the rule and claim passes run."}
          </p>
        </Reveal>
      </div>

      <div className="mt-10 grid items-start gap-1.5 lg:grid-cols-2">
        <Reveal i={1}>
          <div data-ui className="bg-white">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              maxLength={5000}
              aria-label="Text to check"
              className="block w-full resize-y bg-white px-5 py-5 text-[18px] leading-[1.55] text-soot outline-none"
            />
            <div className="flex flex-wrap items-center gap-2 bg-ash-50 px-4 py-3">
              {TRY.map((t, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setText(t);
                    run(t);
                  }}
                  className="lift rounded-md bg-white px-3 py-1.5 text-[14px] font-medium text-soot hover:bg-ash-100"
                >
                  Example {i + 1}
                </button>
              ))}
              <Button className="ml-auto !bg-soot !text-lime hover:!bg-soot-3" loading={busy} onClick={() => run()} disabled={!text.trim()}>
                Check it
              </Button>
            </div>
          </div>
        </Reveal>

        <Reveal i={2}>
          <div data-ui className="min-h-[320px] bg-white p-5" aria-live="polite">
            <ErrorNote error={error} />
            {!res && !busy && !error && (
              <div className="grid min-h-[280px] content-center">
                <p className="text-[20px] font-semibold leading-tight tracking-[-0.02em]">The marks appear here.</p>
                <p className="mt-2 max-w-[36ch] text-[16px] text-muted">Each one with the rule it cites and a fix. Example 1 breaks several rules in one line.</p>
              </div>
            )}
            {busy && !res && (
              <div className="grid gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-16" />
                ))}
              </div>
            )}
            {res && (
              <div className={cx("grid gap-4 transition-opacity", busy && "opacity-50")}>
                <div className="flex items-center gap-4">
                  <ScoreRing score={res.score} size={56} stroke={5} />
                  <p className="text-[15px]">
                    <b className="num font-semibold">{res.findings.length}</b> finding{res.findings.length === 1 ? "" : "s"} in <span className="num">{res.durationMs} ms</span>
                    {res.dropped > 0 && <span className="text-muted"> · {res.dropped} unverifiable AI finding(s) dropped</span>}
                  </p>
                </div>
                <div className="bg-ash-50 p-4 text-[18px] leading-[1.6]">
                  <DraftView text={checked} findings={rows} activeId={active} onSelect={setActive} className="text-[17px]" />
                </div>
                <ul className="grid gap-1">
                  {rows.map((f) => (
                    <li
                      key={f.id}
                      onMouseEnter={() => setActive(f.id)}
                      className={cx("grid gap-1 px-3 py-2.5 text-[14px] transition-colors", active === f.id ? "bg-lime" : "bg-ash-50")}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge s={f.severity} />
                        <span className="font-medium">“{f.quote}”</span>
                        {f.fix && <span className="ml-auto text-green-700">→ {f.fix}</span>}
                      </div>
                      <p>{f.message}</p>
                      <p className="text-[13px] text-muted">
                        {f.cites.label}
                        {f.ai && ` · AI, ${Math.round(f.confidence * 100)}% confident`}
                      </p>
                    </li>
                  ))}
                  {rows.length === 0 && <li className="bg-green-50 px-3 py-3 text-[15px] text-green-700">On brand. Nothing to fix.</li>}
                </ul>
                <p className="text-[13px] text-muted">
                  AI use: {res.ai.provider ?? "none"}. {res.ai.note}
                </p>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------- what it checks: plain names in columns ----------

export function Names({ columns }: { columns: KitColumn[] }) {
  return (
    <section className="bg-white px-[var(--margin)] py-[clamp(72px,8vw,128px)] text-soot">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <Reveal className="lg:col-span-3">
          <h2 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] lg:text-[32px]">What it holds you to</h2>
          <p className="mt-4 max-w-[30ch] text-[16px] leading-[1.5] text-muted">The demo QuickKart Brand Kit. Yours is imported from your own guideline PDF.</p>
        </Reveal>
        <Reveal i={1} className="grid grid-cols-2 gap-x-5 gap-y-8 text-[15px] leading-[1.5] lg:col-span-8 lg:col-start-5 lg:grid-cols-4 lg:gap-x-8 lg:text-[16px]">
          {columns.map((c) => (
            <div key={c.kind}>
              <p className="text-muted">{c.kind}</p>
              {c.names.map((n) => (
                <p key={n}>{n}</p>
              ))}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ---------- close ----------

export function Closing() {
  return (
    <>
      <section className="bg-ash-50 px-[var(--margin)] py-[clamp(72px,8vw,128px)] text-soot">
        <Reveal className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <h2 className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]">See the whole review flow</h2>
            <p className="mt-4 max-w-[56ch] text-[17px] leading-[1.55] text-muted lg:text-[18px]">
              The workspace is a working demo. Switch between Creator, Reviewer, Approver and Admin from the top bar; each role can do only what the role matrix allows.
            </p>
          </div>
          <Link href="/queue" className="lift inline-flex h-11 shrink-0 items-center rounded-lg bg-soot px-5 text-[15px] font-medium text-white hover:bg-soot-3">
            Open the workspace
          </Link>
        </Reveal>
      </section>
      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="on-soot bg-soot px-[var(--margin)] py-10 text-[14px] leading-[1.55] text-ash-300">
      <div className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6">
        <div className="grid max-w-[64ch] gap-3">
          <Logo tone="paper" />
          <p>Built by Team Diet Code: Jeman Kalita (VIT Vellore) and Krishnesha Sarma (SRM KTR). Problem statement by Inkloom AI. QuickKart is a fictional brand.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          <Link href="/queue" className="hover:text-white">Workspace</Link>
          <Link href="/kit" className="hover:text-white">Brand Kit</Link>
          <Link href="/insights" className="hover:text-white">Insights</Link>
          <a href="https://github.com/jemankalita/plumbline" className="hover:text-white">Source</a>
        </nav>
      </div>
    </footer>
  );
}
