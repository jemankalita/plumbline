"use client";

import { diffWords } from "diff";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCopy,
  FileClock,
  ImageIcon,
  PencilLine,
  RefreshCw,
  Send,
  ShieldAlert,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { can } from "@/lib/auth-shared";
import type { SubmissionDetail } from "@/lib/db/repo";
import type { FindingRow, FindingStatus, PaletteColor, Role, Severity } from "@/lib/types";
import { applyAccepted, DraftView } from "./DraftView";
import { FindingCard } from "./FindingCard";
import { api, Button, Card, CLAIM, cx, ErrorNote, inputCls, Pill, ScoreRing, scoreTone, StatusPill, timeAgo } from "./ui";

type Filter = "open" | Severity | "all";

const WEIGHT = { blocker: 18, warning: 7, suggestion: 2 } as const;
const liveScore = (fs: FindingRow[]) =>
  Math.max(0, 100 - fs.filter((f) => f.status === "open" || f.status === "disputed").reduce((s, f) => s + WEIGHT[f.severity], 0));

export function ReviewWorkspace({ detail, palette, role }: { detail: SubmissionDetail; palette: PaletteColor[]; role: Role }) {
  const router = useRouter();
  const { submission: sub, revisions, audit } = detail;
  const rev = revisions[revisions.length - 1];
  const [findings, setFindings] = useState(detail.findings);
  // Re-sync with fresh server data after router.refresh() (derived during render, not in an effect).
  const [synced, setSynced] = useState(detail.findings);
  if (synced !== detail.findings) {
    setSynced(detail.findings);
    setFindings(detail.findings);
  }

  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [askChanges, setAskChanges] = useState(false);
  const [diffWith, setDiffWith] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const isOpen = (f: FindingRow) => f.status === "open" || f.status === "disputed";
  const open = findings.filter(isOpen);
  const blockers = open.filter((f) => f.severity === "blocker").length;
  const routed = open.filter((f) => f.needsReview).length;
  const accepted = findings.filter((f) => f.status === "accepted" && f.fix && f.start >= 0).length;
  const score = liveScore(findings);
  const working = useMemo(() => applyAccepted(rev.text, findings), [rev.text, findings]);
  const tone = scoreTone(score);

  const counts = {
    open: open.length,
    blocker: findings.filter((f) => f.severity === "blocker").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    suggestion: findings.filter((f) => f.severity === "suggestion").length,
    all: findings.length,
  };
  const listed = findings.filter((f) => (filter === "all" ? true : filter === "open" ? isOpen(f) : f.severity === filter));

  const select = (id: string) => {
    setActive(id);
    const target = findings.find((f) => f.id === id);
    if (target && filter !== "all" && !listed.includes(target)) setFilter("all");
    requestAnimationFrame(() => document.getElementById(`finding-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  async function decide(f: FindingRow, status: FindingStatus, reason?: string): Promise<boolean> {
    setBusy(f.id);
    setError(null);
    const before = findings;
    setFindings((xs) => xs.map((x) => (x.id === f.id ? { ...x, status, reason: reason ?? x.reason, decidedBy: role } : x)));
    try {
      await api(`/api/findings/${f.id}`, { method: "PATCH", body: { status, reason } });
      router.refresh();
      return true;
    } catch (e) {
      setFindings(before);
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function recheck(text: string) {
    setBusy("recheck");
    setError(null);
    try {
      await api(`/api/submissions/${sub.id}/revisions`, { body: { text } });
      setEditing(false);
      setActive(null);
      setFilter("open");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function workflow(action: "send" | "approve" | "request_changes") {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/submissions/${sub.id}/status`, { body: { action, note: note.trim() || null } });
      setAskChanges(false);
      setNote("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const prev = diffWith != null ? revisions.find((r) => r.n === diffWith) : null;
  const imageFindings = findings.filter((f) => f.start < 0);

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/queue" className="inline-flex items-center gap-1 text-sm text-muted hover:text-navy">
            <ArrowLeft className="size-4" /> Queue
          </Link>
          <h1 className="mt-2 font-serif text-[34px] leading-[1.05] tracking-tight text-navy sm:text-[42px]">{sub.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusPill s={sub.status} />
            <span>{sub.channel}</span>
            <span aria-hidden>·</span>
            <span>v{rev.n}</span>
            <span aria-hidden>·</span>
            <span>checked {timeAgo(rev.createdAt)}</span>
            {sub.aiAssisted && (
              <Pill className="bg-white text-muted ring-line">
                <Bot className="size-3" /> AI-assisted draft
              </Pill>
            )}
          </div>
          {sub.keyMessage && (
            <p className="mt-2 text-sm text-ink">
              <span className="kicker mr-2">Intent lock</span>“{sub.keyMessage}”
            </p>
          )}
        </div>

        <Card className="flex items-center gap-4 px-4 py-3">
          <ScoreRing score={score} size={68} />
          <div className="leading-tight">
            <p className={cx("font-medium", tone.text)}>{tone.word}</p>
            <p className="num text-xs text-muted">
              {open.length} open · {blockers} blocker{blockers === 1 ? "" : "s"}
            </p>
            {revisions.length > 1 && (
              <p className="num mt-0.5 text-xs text-muted">
                v1 {revisions[0].score} → v{rev.n} {score}
              </p>
            )}
          </div>
        </Card>
      </div>

      <WorkflowBar
        role={role}
        status={sub.status}
        blockers={blockers}
        routed={routed}
        busy={busy}
        askChanges={askChanges}
        setAskChanges={setAskChanges}
        note={note}
        setNote={setNote}
        onAction={workflow}
        onCopy={async () => {
          await navigator.clipboard.writeText(working).catch(() => null);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        copied={copied}
      />

      <AnimatePresence>{error && <ErrorNote error={error} />}</AnimatePresence>

      <div className="grid min-w-0 items-start gap-6 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(340px,1fr)]">
        {/* draft column */}
        <div className="grid min-w-0 gap-4 lg:sticky lg:top-20 [&>*]:min-w-0">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-2 border-b border-hair px-4 py-2.5">
              <p className="kicker">{editing ? "Editing" : prev ? `Changes since v${prev.n}` : "Draft"}</p>
              <div className="ml-auto flex items-center gap-1.5">
                {revisions.length > 1 && !editing && (
                  <select
                    aria-label="Compare with an earlier version"
                    value={diffWith ?? ""}
                    onChange={(e) => setDiffWith(e.target.value ? Number(e.target.value) : null)}
                    className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink"
                  >
                    <option value="">Findings view</option>
                    {revisions.slice(0, -1).map((r) => (
                      <option key={r.id} value={r.n}>
                        Compare with v{r.n} ({r.score})
                      </option>
                    ))}
                  </select>
                )}
                {can(role, "editDraft") && !editing && sub.status !== "approved" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<PencilLine className="size-3.5" />}
                    onClick={() => {
                      setDraft(working);
                      setEditing(true);
                      setDiffWith(null);
                    }}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>
            <div className="px-5 py-5 sm:px-7 sm:py-6">
              {editing ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  autoFocus
                  aria-label="Draft text"
                  className="w-full resize-y bg-transparent font-serif text-[22px] leading-[1.6] text-navy outline-none"
                />
              ) : prev ? (
                <DiffView before={prev.text} after={rev.text} />
              ) : (
                <DraftView text={rev.text} findings={findings} activeId={active} onSelect={select} />
              )}
            </div>
            {(editing || accepted > 0) && sub.status !== "approved" && can(role, "editDraft") && (
              <div className="flex flex-wrap items-center gap-2 border-t border-hair bg-sky-50/60 px-4 py-3">
                <p className="text-[13px] text-ink">
                  {editing ? "Plumbline re-runs every check on the new version." : `${accepted} fix${accepted === 1 ? "" : "es"} applied. Save them as v${rev.n + 1} and re-check.`}
                </p>
                <div className="ml-auto flex gap-1.5">
                  {editing && (
                    <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="primary"
                    loading={busy === "recheck"}
                    icon={<RefreshCw className="size-3.5" />}
                    onClick={() => recheck(editing ? draft : working)}
                    disabled={editing && !draft.trim()}
                  >
                    Save v{rev.n + 1} &amp; re-check
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {rev.image && <ImagePanel image={rev.image} findings={imageFindings} palette={palette} onSelect={select} />}

          {rev.claims.length > 0 && (
            <Card className="px-4 py-3.5">
              <p className="kicker">Claims found · checked against the facts register</p>
              <ul className="mt-2 grid gap-1.5">
                {rev.claims.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-serif text-[17px] text-navy">“{c.quote}”</span>
                    <Pill className={cx("shrink-0 ring-transparent", CLAIM[c.status].cls)}>
                      {CLAIM[c.status].label}
                      {c.factId ? ` · ${c.factId}` : ""}
                    </Pill>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex items-start gap-2.5 rounded-2xl border border-dashed border-sky-300 bg-white/60 px-4 py-3 text-xs text-ink">
            <Bot className="mt-0.5 size-4 shrink-0 text-sky-600" />
            <p>
              <b className="font-medium text-navy">AI use for this check: </b>
              {rev.ai.provider ? `${rev.ai.provider} (${rev.ai.passes.join(", ")} pass). ` : "none. "}
              {rev.ai.note} {rev.dropped > 0 && `The verifier rejected ${rev.dropped} AI finding(s) whose quote or rule didn't exist.`}
            </p>
          </div>
        </div>

        {/* findings column */}
        <div className="grid min-w-0 gap-3 [&>*]:min-w-0">
          <div className="flex gap-1 overflow-x-auto rounded-xl bg-sky-100/60 p-1 text-[13px]" role="tablist" aria-label="Filter findings">
            {(["open", "blocker", "warning", "suggestion", "all"] as Filter[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                onClick={() => setFilter(k)}
                className={cx(
                  "relative flex-1 whitespace-nowrap rounded-lg px-1.5 py-1.5 capitalize transition-colors",
                  filter === k ? "font-medium text-navy" : "text-muted hover:text-navy"
                )}
              >
                {filter === k && <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-lg bg-white shadow-soft" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <span className="relative">
                  {k === "all" ? "All" : k === "open" ? "Open" : k + "s"} <span className="num text-sky-600">{counts[k]}</span>
                </span>
              </button>
            ))}
          </div>

          {listed.length === 0 ? (
            <Card className="grid place-items-center gap-2 px-6 py-12 text-center">
              <CheckCircle2 className="size-8 text-mint" />
              <p className="font-serif text-2xl text-navy">{filter === "open" ? "Nothing open" : "Nothing here"}</p>
              <p className="max-w-xs text-sm text-muted">
                {filter === "open" ? "Every finding on this version has been decided." : "No findings of this kind on this version."}
              </p>
            </Card>
          ) : (
            <motion.div layout className="grid gap-3">
              <AnimatePresence initial={false}>
                {listed.map((f) => (
                  <motion.div key={f.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}>
                    <FindingCard f={f} role={role} active={active === f.id} busy={busy === f.id} onSelect={() => setActive(f.id)} onDecide={(s, r) => decide(f, s, r)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          <Card className="px-4 py-3.5">
            <p className="kicker flex items-center gap-1.5">
              <FileClock className="size-3.5" /> Activity · audit trail
            </p>
            <ol className="mt-2.5 grid gap-2.5">
              {audit.slice(0, 12).map((a) => (
                <li key={a.id} className="grid grid-cols-[auto_1fr] gap-2.5 text-[13px]">
                  <span className="mt-1.5 size-1.5 rounded-full bg-sky-400" aria-hidden />
                  <span>
                    <span className="font-medium capitalize text-navy">{a.role}</span> <span className="text-ink">{a.detail}</span>
                    <span className="block text-xs text-muted">{timeAgo(a.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WorkflowBar(props: {
  role: Role;
  status: SubmissionDetail["submission"]["status"];
  blockers: number;
  routed: number;
  busy: string | null;
  askChanges: boolean;
  setAskChanges: (v: boolean) => void;
  note: string;
  setNote: (v: string) => void;
  onAction: (a: "send" | "approve" | "request_changes") => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const { role, status, blockers, routed, busy } = props;
  let body: React.ReactNode = null;

  if (status === "approved") {
    body = (
      <>
        <CheckCircle2 className="size-5 text-mint" />
        <p className="text-sm text-navy">
          <b className="font-medium">Approved for publishing.</b> Plumbline never publishes. Copy the final text into your tool.
        </p>
        <Button className="ml-auto" size="sm" variant="secondary" icon={props.copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />} onClick={props.onCopy}>
          {props.copied ? "Copied" : "Copy final text"}
        </Button>
      </>
    );
  } else if (can(role, "approve") && status === "in_review") {
    const blocked = blockers > 0 || routed > 0;
    body = (
      <>
        <ShieldAlert className={cx("size-5", blocked ? "text-coral" : "text-mint")} />
        <p className="text-sm text-navy">
          {blocked
            ? `${blockers ? `${blockers} blocker${blockers > 1 ? "s" : ""} open` : ""}${blockers && routed ? " and " : ""}${routed ? `${routed} item${routed > 1 ? "s" : ""} waiting for a reviewer` : ""}. Override or wait before approving.`
            : "Pre-checked and clear of blockers. Ready for your sign-off."}
        </p>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => props.setAskChanges(!props.askChanges)}>
            Request changes
          </Button>
          <Button size="sm" variant="success" disabled={blocked} loading={busy === "approve"} icon={<Check className="size-3.5" />} onClick={() => props.onAction("approve")}>
            Approve
          </Button>
        </div>
      </>
    );
  } else if (can(role, "submit") && (status === "draft" || status === "changes_requested")) {
    body = (
      <>
        <Send className="size-5 text-sky-600" />
        <p className="text-sm text-navy">
          {blockers ? `${blockers} blocker${blockers > 1 ? "s" : ""} still open. An approver will see ${blockers > 1 ? "them" : "it"}.` : "Looks good. Send it to an approver when you're ready."}
        </p>
        <Button className="ml-auto" size="sm" variant="primary" loading={busy === "send"} icon={<Send className="size-3.5" />} onClick={() => props.onAction("send")}>
          Send for approval
        </Button>
      </>
    );
  } else if (can(role, "clearClaim") && routed > 0) {
    body = (
      <>
        <ShieldAlert className="size-5 text-sky-600" />
        <p className="text-sm text-navy">
          {routed} item{routed > 1 ? "s" : ""} routed to you. Check each claim and clear it, or leave it for the creator to fix.
        </p>
      </>
    );
  } else {
    body = <p className="text-sm text-muted">Viewing as {role}. {status === "in_review" ? "Waiting for an approver." : "Waiting for the creator."}</p>;
  }

  return (
    <div className="rounded-2xl border border-line bg-white shadow-soft">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">{body}</div>
      <AnimatePresence>
        {props.askChanges && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-2 border-t border-hair px-4 py-3 sm:flex-row">
              <input
                autoFocus
                value={props.note}
                onChange={(e) => props.setNote(e.target.value)}
                placeholder="What should the creator change?"
                className={inputCls}
              />
              <Button variant="primary" loading={busy === "request_changes"} onClick={() => props.onAction("request_changes")}>
                Send back
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DiffView({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <div className="whitespace-pre-wrap font-serif text-[22px] leading-[1.6] text-navy">
      {parts.map((p, i) =>
        p.added ? (
          <ins key={i} className="rounded bg-mint-50 px-0.5 text-mint-700 no-underline">
            {p.value}
          </ins>
        ) : p.removed ? (
          <del key={i} className="rounded bg-coral-50 px-0.5 text-coral-700/80">
            {p.value}
          </del>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </div>
  );
}

function ImagePanel({
  image,
  findings,
  palette,
  onSelect,
}: {
  image: NonNullable<SubmissionDetail["revisions"][number]["image"]>;
  findings: FindingRow[];
  palette: PaletteColor[];
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="grid gap-3 px-4 py-3.5 sm:grid-cols-[140px_1fr]">
      <div className="grid aspect-[4/3] w-full max-w-[220px] place-items-center overflow-hidden rounded-xl border border-line bg-sky-50">
        {image.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.thumbnail} alt={image.altText || "Uploaded image (no alt text yet)"} className="size-full object-cover" />
        ) : (
          <div className="flex size-full">
            {image.colors.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="kicker flex items-center gap-1.5">
          <ImageIcon className="size-3.5" /> {image.name}
        </p>
        <p className="mt-1 text-sm text-ink">
          Alt text: {image.altText?.trim() ? <span className="text-navy">“{image.altText}”</span> : <span className="text-coral-700">missing</span>}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>Dominant</span>
          {image.colors.map((c) => (
            <span key={c} className="num inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5">
              <span className="size-3 rounded-sm ring-1 ring-black/10" style={{ background: c }} />
              {c}
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>Brand</span>
          {palette.map((p) => (
            <span key={p.hex} title={p.name} className="size-4 rounded-sm ring-1 ring-black/10" style={{ background: p.hex }} />
          ))}
        </div>
        {findings.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {findings.map((f) => (
              <button key={f.id} onClick={() => onSelect(f.id)} className="rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-700 hover:bg-sky-100">
                {f.cites.label}: {f.status === "open" ? "open" : f.status}
              </button>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
