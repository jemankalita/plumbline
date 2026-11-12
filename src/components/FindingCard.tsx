"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Bot, Check, ChevronDown, Code2, Gavel, MessageSquareWarning, PencilLine, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { can } from "@/lib/auth-shared";
import type { FindingRow, FindingStatus, ReasonCode, Role } from "@/lib/types";
import { Button, CLAIM, cx, DECISION, inputCls, Pill, SeverityBadge } from "./ui";

type Mode = null | "dispute" | "override" | "clear" | "alt" | "dismiss";

const REASONS: { code: ReasonCode; label: string }[] = [
  { code: "wrong", label: "The check is wrong" },
  { code: "valid_but_exception", label: "Fair, but an exception here" },
  { code: "rule_outdated", label: "The rule is out of date" },
  { code: "not_useful", label: "Not useful" },
];

/** Who found this: the reader should always know whether a person can trust it as a measurement. */
function sourceOf(f: FindingRow): { label: string; ai: boolean } {
  if (f.pass === "video") return { label: f.ai ? "AI read it, code checked it" : "Measured by code", ai: f.ai };
  if (f.altFix) return { label: "Found by code, fix by AI", ai: true };
  if (f.ai && f.pass === "image") return { label: f.quote.startsWith("Text on") ? "AI read it, code checked it" : `AI looked at the image · ${Math.round(f.confidence * 100)}%`, ai: true };
  if (f.ai) return { label: `AI judgement · ${Math.round(f.confidence * 100)}%`, ai: true };
  if (f.pass === "claims") return { label: "Checked against facts", ai: false };
  return { label: f.pass === "image" ? "Measured by code" : "Brand rule", ai: false };
}

export function FindingCard({
  f,
  role,
  active,
  busy,
  locked,
  onSelect,
  onDecide,
  onEdit,
  onSaveAlt,
  onKeepRule,
}: {
  f: FindingRow;
  role: Role;
  active: boolean;
  busy: boolean;
  locked: boolean;
  onSelect: () => void;
  onDecide: (status: FindingStatus, reason?: string, reasonCode?: ReasonCode) => Promise<boolean>;
  onEdit: () => void;
  onSaveAlt: (alt: string) => void;
  onKeepRule: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [why, setWhy] = useState(false);
  const open = f.status === "open" || f.status === "disputed";
  const canDecide = can(role, "decideFinding") && !locked;
  const canEdit = can(role, "editDraft") && !locked;
  const canClear = can(role, "clearClaim") && f.needsReview && open && !locked;
  const canOverride = can(role, "overrideBlocker") && f.severity === "blocker" && open && !locked;
  const isImage = f.start < 0;
  const oneClick = !!f.fix && !f.fixBreaksIntent && (!isImage || !!f.altFix);
  const source = sourceOf(f);

  const submit = async () => {
    if (mode === "alt") return onSaveAlt(reason.trim());
    if (mode === "dismiss") return;
    const status: FindingStatus = mode === "dispute" ? "disputed" : mode === "override" ? "overridden" : "cleared";
    if (await onDecide(status, reason.trim() || undefined)) {
      setMode(null);
      setReason("");
    }
  };

  const mayUndo = !open && !locked && (canDecide || (f.status === "cleared" && can(role, "clearClaim")) || (f.status === "overridden" && can(role, "overrideBlocker")));

  return (
    <motion.article
      layout="position"
      id={`finding-${f.id}`}
      onClick={onSelect}
      className={cx(
        "cursor-pointer rounded-lg border border-l-4 p-4 transition-[border-color,box-shadow,background-color] duration-200",
        f.severity === "blocker" ? "border-l-red" : f.severity === "warning" ? "border-l-amber" : "border-l-ash-400",
        open ? "bg-white" : "bg-ash-50",
        active ? "border-y-ink border-r-ink ring-2 ring-lime" : "border-y-line border-r-line hover:border-y-ash-400 hover:border-r-ash-400"
      )}
    >
      <header className="flex flex-wrap items-center gap-1.5">
        <SeverityBadge s={f.severity} />
        <span className="inline-flex items-center gap-1 text-[13px] text-muted">
          {source.ai ? <Bot className="size-3.5" aria-hidden /> : <Code2 className="size-3.5" aria-hidden />} {source.label}
        </span>
        {!open && (
          <span className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-green-700">
            <Check className="size-3.5" aria-hidden /> {DECISION[f.status]}
          </span>
        )}
      </header>

      <p className="mt-2.5 text-[15px] font-medium leading-snug text-ink">{isImage ? f.quote : <>“{f.quote}”</>}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-ink">{f.message}</p>

      {f.needsReview && open && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-ash-700">
          <ShieldCheck className="size-3.5" aria-hidden /> Needs reviewer
        </p>
      )}

      {f.fix && (
        <div className="mt-3 rounded-md bg-green-50/70 px-3 py-2 text-sm">
          <p className="text-[13px] font-medium text-green-700">{f.altFix ? "Suggested alt text" : isImage ? "How to fix it" : "Change to"}</p>
          <p className="mt-0.5 font-medium text-green-700">{f.fix}</p>
          {f.fixBreaksIntent && (
            <p className="mt-1 flex items-center gap-1 text-[13px] text-amber-700">
              <AlertTriangle className="size-3.5" aria-hidden /> This would drop part of your key message, so edit it by hand.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        {open && canEdit && oneClick && (
          <Button size="sm" variant="primary" loading={busy} icon={<Check className="size-3.5" />} onClick={() => onDecide("accepted")}>
            {f.altFix ? "Use this alt text" : "Accept fix"}
          </Button>
        )}
        {open && canEdit && !oneClick && !isImage && (
          <Button size="sm" variant="secondary" disabled={busy} icon={<PencilLine className="size-3.5" />} onClick={onEdit}>
            Edit text
          </Button>
        )}
        {open && canEdit && f.altFix && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            icon={<PencilLine className="size-3.5" />}
            onClick={() => {
              setReason(f.fix ?? "");
              setMode("alt");
            }}
          >
            Edit first
          </Button>
        )}
        {open && canEdit && f.alt && !f.fix && (
          <Button size="sm" variant="secondary" disabled={busy} icon={<PencilLine className="size-3.5" />} onClick={() => setMode(mode === "alt" ? null : "alt")}>
            Write alt text
          </Button>
        )}
        {open && canDecide && (!f.fix || isImage) && !f.altFix && (
          <Button size="sm" variant="secondary" disabled={busy} icon={<Check className="size-3.5" />} onClick={() => onDecide("accepted")}>
            Agree, needs fixing
          </Button>
        )}
        {open && canDecide && f.severity !== "blocker" && (
          <Button size="sm" variant="ghost" disabled={busy} icon={<X className="size-3.5" />} onClick={() => setMode(mode === "dismiss" ? null : "dismiss")}>
            Not an issue
          </Button>
        )}
        {canClear && (
          <Button size="sm" variant="primary" disabled={busy} icon={<ShieldCheck className="size-3.5" />} onClick={() => setMode(mode === "clear" ? null : "clear")}>
            Clear it
          </Button>
        )}
        {canOverride && (
          <Button size="sm" variant="danger" disabled={busy} icon={<Gavel className="size-3.5" />} onClick={() => setMode(mode === "override" ? null : "override")}>
            Override
          </Button>
        )}
        {mayUndo && (
          <Button size="sm" variant="ghost" disabled={busy} icon={<RotateCcw className="size-3.5" />} onClick={() => onDecide("open")}>
            Undo
          </Button>
        )}
        <button
          type="button"
          onClick={() => setWhy(!why)}
          aria-expanded={why}
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] text-muted transition-colors hover:bg-ash-100 hover:text-ink"
        >
          Why? <ChevronDown className={cx("size-3.5 transition-transform", why && "rotate-180")} aria-hidden />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {why && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="mt-2 grid gap-2 border-t border-hair pt-2.5 text-[13px] text-muted">
              <p>
                <span className="num text-ash-700">{f.cites.label}</span>: {f.cites.excerpt}
              </p>
              {f.claimStatus && <Pill className={cx("w-fit ring-transparent", CLAIM[f.claimStatus].cls)}>{CLAIM[f.claimStatus].label}</Pill>}
              {open && canDecide && f.status !== "disputed" && (
                <button type="button" className="w-fit text-[13px] font-medium text-ink underline underline-offset-2" onClick={() => setMode(mode === "dispute" ? null : "dispute")}>
                  Disagree with this? Dispute it
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {f.reason && (
        <p className="mt-2 flex items-start gap-2 rounded-md bg-ash-50 px-2.5 py-1.5 text-[13px] text-ink">
          <MessageSquareWarning className="mt-0.5 size-3.5 shrink-0 text-ash-600" aria-hidden />
          <span>
            <b className="font-medium capitalize text-ink">{f.decidedBy}:</b> {f.reason}
          </span>
        </p>
      )}

      {f.calibration && (
        <div className="mt-2 rounded-md bg-ash-50 px-2.5 py-1.5 text-[13px] text-ink" onClick={(e) => e.stopPropagation()}>
          <p>
            <b className="font-medium">{f.calibration.simulated ? "Simulated learning: " : "Learned from your team: "}</b>
            {f.calibration.note}
          </p>
          {f.calibration.action !== "observe" && canDecide && (
            <button type="button" disabled={busy} className="mt-1 font-medium underline underline-offset-2" onClick={onKeepRule}>
              Keep this check at full strength
            </button>
          )}
        </div>
      )}

      {f.carriedFrom != null && (
        <p className="mt-2 text-[13px] text-muted">Decided on version {f.carriedFrom}. Kept because this has not changed.</p>
      )}

      {mode === "dismiss" && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-[13px] font-medium text-ink">Why is this not an issue?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <Button
                key={r.code}
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  if (await onDecide("dismissed", undefined, r.code)) setMode(null);
                }}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {mode && mode !== "dismiss" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="mt-3 grid gap-2">
              <textarea
                autoFocus
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-label={mode === "alt" ? "Alt text" : "Reason"}
                className={inputCls}
                placeholder={
                  mode === "alt"
                    ? "Describe the image, including any words on it"
                    : mode === "dispute"
                    ? "Why is this wrong? e.g. “This figure is from the Oct campaign brief.”"
                    : mode === "override"
                      ? "Reason for publishing anyway (goes in the audit log)"
                      : "Optional: how you verified it, e.g. “Checked with Ops, still true.”"
                }
              />
              <div className="flex gap-1.5">
                <Button size="sm" variant={mode === "override" ? "danger" : "primary"} loading={busy} disabled={mode === "alt" && !reason.trim()} onClick={submit}>
                  {mode === "alt" ? "Save and check again" : mode === "dispute" ? "Send dispute" : mode === "override" ? "Override blocker" : "Mark verified"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
