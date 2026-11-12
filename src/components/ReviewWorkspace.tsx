"use client";

import { diffWords } from "diff";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Bot, CheckCircle2, PencilLine, RefreshCw, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { VideoSummary } from "./review/VideoSummary";
import { useMemo, useRef, useState } from "react";
import { tidyDetail } from "@/lib/audit-labels";
import { can } from "@/lib/auth-shared";
import type { SubmissionDetail } from "@/lib/db/repo";
import { score as scoreOf } from "@/lib/engine/verify";
import { prepareImage } from "@/lib/image-prep";
import type { FindingRow, FindingStatus, ImageInput, PaletteColor, Role, ReasonCode } from "@/lib/types";
import { applyAccepted, DraftView } from "./DraftView";
import { FindingCard } from "./FindingCard";
import { AiActivity, aiSummary } from "./review/AiActivity";
import { ImagePanel } from "./review/ImagePanel";
import { NextStep } from "./review/NextStep";
import { api, Button, Card, CLAIM, cx, ErrorNote, Fold, Pill, ScoreRing, scoreTone, StatusPill, timeAgo } from "./ui";

type Tab = "todo" | "done";

const isOpen = (f: FindingRow) => f.status === "open" || f.status === "disputed";
const aiRan = (r?: SubmissionDetail["revisions"][number]) => !!r?.ai.calls?.some((c) => c.status === "ran");

export function ReviewWorkspace({ detail, palette, role }: { detail: SubmissionDetail; palette: PaletteColor[]; role: Role }) {
  const router = useRouter();
  const { submission: sub, revisions, audit } = detail;
  const rev = revisions[revisions.length - 1];

  const [findings, setFindings] = useState(detail.findings);
  const [saving, setSaving] = useState<string[]>([]);
  // Fresh server data replaces local state, but never while a decision is still on its way:
  // that would flip a card back to its old state.
  const [synced, setSynced] = useState(detail.findings);
  if (synced !== detail.findings && saving.length === 0) {
    setSynced(detail.findings);
    setFindings(detail.findings);
  }

  const inFlight = useRef(0);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todo");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [askChanges, setAskChanges] = useState(false);
  const [diffWith, setDiffWith] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const locked = sub.status === "approved";
  const canEdit = can(role, "editDraft") && !locked;
  const open = findings.filter(isOpen);
  const blockers = open.filter((f) => f.severity === "blocker").length;
  const routed = open.filter((f) => f.needsReview).length;
  const textFixes = findings.filter((f) => f.status === "accepted" && f.fix && f.start >= 0).length;
  const altFix = findings.find((f) => f.status === "accepted" && f.altFix && f.fix);
  const unsaved = textFixes + (altFix ? 1 : 0);
  const score = scoreOf(findings);
  const working = useMemo(() => applyAccepted(rev.text, findings), [rev.text, findings]);
  const tone = scoreTone(score);
  const listed = tab === "todo" ? open : findings.filter((f) => !isOpen(f));
  // Everything about the picture itself has one fix, so it sits in one group with one button.
  const inPicture = (f: FindingRow) => f.start < 0 && !f.alt && !f.altFix && f.pass !== "video";
  const cards = listed.filter((f) => !inPicture(f));
  const pictureCards = listed.filter(inPicture);
  const before = revisions[revisions.length - 2];
  const firstAiDrop = !!before && rev.score < before.score && aiRan(rev) && !aiRan(before);
  const prev = diffWith != null ? revisions.find((r) => r.n === diffWith) : null;

  const select = (id: string) => {
    setActive(id);
    const target = findings.find((f) => f.id === id);
    if (target) setTab(isOpen(target) ? "todo" : "done");
    requestAnimationFrame(() => document.getElementById(`finding-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  async function decide(f: FindingRow, status: FindingStatus, reason?: string, reasonCode?: ReasonCode): Promise<boolean> {
    setError(null);
    setSaving((s) => [...s, f.id]);
    inFlight.current += 1;
    setFindings((xs) => xs.map((x) => (x.id === f.id ? { ...x, status, reason: reason ?? x.reason, reasonCode: reasonCode ?? null, decidedBy: role } : x)));
    try {
      await api(`/api/findings/${f.id}`, { method: "PATCH", body: { status, reason, reasonCode } });
      return true;
    } catch (e) {
      setFindings((xs) => xs.map((x) => (x.id === f.id ? f : x)));
      setError((e as Error).message);
      return false;
    } finally {
      inFlight.current -= 1;
      setSaving((s) => s.filter((id) => id !== f.id));
      if (inFlight.current === 0) router.refresh();
    }
  }

  async function keepRule(f: FindingRow) {
    setError(null);
    try {
      await api(`/api/findings/${f.id}/calibration`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveVersion(text: string, image?: ImageInput | null) {
    setBusy("recheck");
    setError(null);
    try {
      await api(`/api/submissions/${sub.id}/revisions`, { body: { text, image } });
      setEditing(false);
      setActive(null);
      setTab("todo");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  /** Save accepted fixes, including accepted alt text, as the next version. */
  const saveFixes = (text = working) => saveVersion(text, altFix && rev.image ? { ...rev.image, altText: altFix.fix } : undefined);

  const saveAlt = (alt: string) => {
    if (rev.image) saveVersion(working, { ...rev.image, altText: alt });
  };

  async function replaceImage(file: File) {
    setError(null);
    try {
      await saveVersion(working, await prepareImage(file, file.name));
    } catch (e) {
      setError((e as Error).message);
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

  async function switchRole(next: Role) {
    await api("/api/role", { body: { role: next } }).catch((e: Error) => setError(e.message));
    router.refresh();
  }

  const startEdit = () => {
    setDraft(working);
    setEditing(true);
    setDiffWith(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="grid min-w-0 gap-5 [&>*]:min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/queue" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> Queue
          </Link>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink">{sub.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <StatusPill s={sub.status} />
            <span>{sub.channel}</span>
            <span aria-hidden>·</span>
            <span>Version {rev.n}</span>
            {sub.aiAssisted && (
              <Pill className="bg-white text-muted ring-line">
                <Bot className="size-3" aria-hidden /> Written with AI
              </Pill>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ScoreRing score={score} size={60} />
          <p className={cx("font-medium leading-tight", tone.text)}>{tone.word}</p>
        </div>
      </header>

      <NextStep
        role={role}
        status={sub.status}
        open={open.length}
        blockers={blockers}
        routed={routed}
        unsaved={unsaved}
        busy={busy}
        askChanges={askChanges}
        setAskChanges={setAskChanges}
        note={note}
        setNote={setNote}
        copied={copied}
        onAction={workflow}
        onCopy={async () => {
          await navigator.clipboard.writeText(working).catch(() => null);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
        onSwitchRole={switchRole}
      />

      {firstAiDrop && (
        <p className="flex items-start gap-2 rounded-lg bg-white px-4 py-3 text-[14px] text-ink ring-1 ring-line">
          <Bot className="mt-0.5 size-4 shrink-0 text-ash-600" aria-hidden />
          <span>
            Version {before.n} scored {before.score} on plain-code checks alone. AI has now looked at this version for the first time and found problems code can&apos;t see, so the score dropped to {rev.score}. Your fixes were kept.
          </span>
        </p>
      )}

      <AnimatePresence>{error && <ErrorNote error={error} />}</AnimatePresence>

      <div className="grid min-w-0 items-start gap-5 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)] lg:grid-rows-[auto_1fr]">
        {/* On a phone the issues follow the draft directly; the log, claims and history come after. */}
        <div className="grid min-w-0 gap-4 [&>*]:min-w-0 lg:col-start-1 lg:row-start-1">
          {rev.image && <ImagePanel image={rev.image} report={rev.imageReport ?? null} palette={palette} canReplace={canEdit} busy={busy === "recheck"} onReplace={replaceImage} />}

          {(rev.text || editing) && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-hair px-4 py-2.5">
                <p className="text-[14px] font-medium text-ink">{editing ? "Editing" : prev ? `Changes since version ${prev.n}` : "Text"}</p>
                {canEdit && !editing && (
                  <Button className="ml-auto" size="sm" variant="ghost" icon={<PencilLine className="size-3.5" />} onClick={startEdit}>
                    Edit
                  </Button>
                )}
              </div>
              <div className="px-5 py-5 sm:px-6">
                {editing ? (
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={7} autoFocus aria-label="Draft text" className="w-full resize-y bg-transparent text-[18px] leading-[1.7] text-ink outline-none" />
                ) : prev ? (
                  <DiffView before={prev.text} after={rev.text} />
                ) : (
                  <DraftView text={rev.text} findings={findings} activeId={active} onSelect={select} />
                )}
              </div>
              {editing && (
                <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-hair bg-ash-50/60 px-4 py-3">
                  <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" variant="primary" loading={busy === "recheck"} icon={<RefreshCw className="size-3.5" />} onClick={() => saveFixes(draft)} disabled={!draft.trim() && !rev.image}>
                    Save and check again
                  </Button>
                </div>
              )}
            </Card>
          )}
          {!rev.text && !editing && canEdit && (
            <Button className="w-fit" size="sm" variant="ghost" icon={<PencilLine className="size-3.5" />} onClick={startEdit}>
              Add a caption
            </Button>
          )}

        </div>

        <section className="grid min-w-0 gap-3 [&>*]:min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Issues">
          <div className="flex gap-1 rounded-lg bg-white p-1 text-[14px] ring-1 ring-line" role="tablist" aria-label="Issues">
            {(["todo", "done"] as Tab[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={cx("flex-1 rounded-md px-2 py-1.5 transition-colors", tab === k ? "bg-soot font-medium text-white" : "text-ink hover:bg-ash-50")}
              >
                {k === "todo" ? "To do" : "Done"} <span className="num opacity-70">{k === "todo" ? open.length : findings.length - open.length}</span>
              </button>
            ))}
          </div>

          {listed.length === 0 ? (
            <Card className="grid place-items-center gap-2 px-6 py-12 text-center">
              <CheckCircle2 className="size-8 text-green" aria-hidden />
              <p className="text-lg font-semibold text-ink">{tab === "todo" ? "Nothing left to do" : "Nothing decided yet"}</p>
              <p className="max-w-xs text-sm text-muted">{tab === "todo" ? "Every issue on this version has been decided." : "Accepted fixes and other decisions appear here."}</p>
            </Card>
          ) : (
            <>
              {rev.video && <VideoSummary video={rev.video} />}
              {cards.length > 0 && <CardList items={cards} role={role} activeId={active} saving={saving} locked={locked} onSelect={setActive} onDecide={decide} onEdit={startEdit} onSaveAlt={saveAlt} onKeepRule={keepRule} />}
              {pictureCards.length > 0 && (
                <div className="grid gap-3">
                  <p className="pt-1 text-[14px] font-medium text-ink">In the picture ({pictureCards.length})</p>
                  <CardList items={pictureCards} role={role} activeId={active} saving={saving} locked={locked} onSelect={setActive} onDecide={decide} onEdit={startEdit} onSaveAlt={saveAlt} onKeepRule={keepRule} />
                </div>
              )}
            </>
          )}
        </section>

        <div className="grid min-w-0 gap-4 [&>*]:min-w-0 lg:col-start-1 lg:row-start-2">
          <Fold title={aiSummary(rev.ai)} icon={<Bot className="size-4 text-ash-600" aria-hidden />} defaultOpen>
            <AiActivity ai={rev.ai} canRun={canEdit} busy={busy === "recheck"} onRun={() => saveFixes()} />
          </Fold>

          {rev.claims.length > 0 && (
            <Fold title={`Claims checked against approved facts (${rev.claims.length})`}>
              <ul className="grid gap-1.5 px-4 py-3">
                {rev.claims.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink">“{c.quote}”</span>
                    <Pill className={cx("shrink-0 ring-transparent", CLAIM[c.status].cls)}>
                      {CLAIM[c.status].label}
                      {c.factId ? ` · ${c.factId}` : ""}
                    </Pill>
                  </li>
                ))}
              </ul>
            </Fold>
          )}

          <Fold title={`History (${audit.length})`}>
            <div className="grid gap-3 px-4 py-3">
              {revisions.length > 1 && (
                <label className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                  Compare text with
                  <select value={diffWith ?? ""} onChange={(e) => setDiffWith(e.target.value ? Number(e.target.value) : null)} className="h-8 rounded-md border border-line bg-white px-2 text-[13px] text-ink">
                    <option value="">Nothing</option>
                    {revisions.slice(0, -1).map((r) => (
                      <option key={r.id} value={r.n}>
                        Version {r.n} (score {r.score})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <ol className="grid gap-2.5">
                {audit.slice(0, 12).map((a) => (
                  <li key={a.id} className="text-[13px]">
                    <span className="font-medium capitalize text-ink">{a.role}</span> <span className="text-ink">{tidyDetail(a.detail)}</span>
                    <span className="block text-muted" suppressHydrationWarning>{timeAgo(a.at)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Fold>
        </div>
      </div>

      <AnimatePresence>
        {unsaved > 0 && canEdit && !editing && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-lg bg-soot px-4 py-3 text-white shadow-lift" role="status">
            <CheckCircle2 className="size-5 text-lime" aria-hidden />
            <p className="text-[15px]">
              {unsaved} fix{unsaved === 1 ? "" : "es"} applied. Save to create version {rev.n + 1} and check it again.
            </p>
            <Button className="ml-auto" size="sm" variant="primary" loading={busy === "recheck"} icon={<RefreshCw className="size-3.5" />} onClick={() => saveFixes()}>
              Save and check again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CardListProps {
  items: FindingRow[];
  role: Role;
  activeId: string | null;
  saving: string[];
  locked: boolean;
  onSelect: (id: string) => void;
  onDecide: (f: FindingRow, status: FindingStatus, reason?: string, reasonCode?: ReasonCode) => Promise<boolean>;
  onEdit: () => void;
  onSaveAlt: (alt: string) => void;
  onKeepRule: (f: FindingRow) => void;
}

const isQuiet = (f: FindingRow) => f.calibration?.action === "quieten" && (f.status === "open" || f.status === "disputed");

function CardList({ items, ...rest }: CardListProps) {
  const [showOptional, setShowOptional] = useState(false);
  const quiet = items.filter(isQuiet);
  const loud = items.filter((f) => !isQuiet(f));
  // Blockers and warnings come first. Suggestions never block, so they wait behind one button
  // when there is something more important to do, and open by themselves when picked in the draft.
  const mustSee = loud.filter((f) => f.severity !== "suggestion");
  const optional = loud.filter((f) => f.severity === "suggestion");
  const fold = mustSee.length > 0 && optional.length > 0;
  const showingOptional = !fold || showOptional || optional.some((f) => f.id === rest.activeId);
  return (
    <div className="grid gap-3">
      {(fold ? mustSee : loud).length > 0 && <Cards items={fold ? mustSee : loud} {...rest} />}
      {fold && showingOptional && <Cards items={optional} {...rest} />}
      {fold && (
        <button
          type="button"
          onClick={() => setShowOptional(!showingOptional)}
          aria-expanded={showingOptional}
          className="justify-self-start rounded-lg px-3 py-2 text-sm font-medium text-ink ring-1 ring-inset ring-ash-200 hover:bg-ash-50"
        >
          {showingOptional ? "Hide suggestions" : `Show ${optional.length} suggestion${optional.length === 1 ? "" : "s"} · optional, never blocks approval`}
        </button>
      )}
      {quiet.length > 0 && (
        <details className="rounded-lg border border-line bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">Low priority ({quiet.length}): usually dismissed</summary>
          <div className="mt-3">
            <Cards items={quiet} {...rest} />
          </div>
        </details>
      )}
    </div>
  );
}

function Cards({ items, role, activeId, saving, locked, onSelect, onDecide, onEdit, onSaveAlt, onKeepRule }: CardListProps) {
  return (
    <div className="grid gap-3">
      <AnimatePresence initial={false} mode="popLayout">
        {items.map((f) => (
          <motion.div key={f.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}>
            <FindingCard
              f={f}
              role={role}
              active={activeId === f.id}
              busy={saving.includes(f.id)}
              locked={locked}
              onSelect={() => onSelect(f.id)}
              onDecide={(status, reason, code) => onDecide(f, status, reason, code)}
              onEdit={onEdit}
              onSaveAlt={onSaveAlt}
              onKeepRule={() => onKeepRule(f)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function DiffView({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <div className="whitespace-pre-wrap text-[18px] leading-[1.7] text-ink">
      {parts.map((p, i) =>
        p.added ? (
          <ins key={i} className="rounded bg-green-50 px-0.5 text-green-700 no-underline">
            {p.value}
          </ins>
        ) : p.removed ? (
          <del key={i} className="rounded bg-red-50 px-0.5 text-red-700/80">
            {p.value}
          </del>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </div>
  );
}
