"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, BookOpen, Bot, Check, Gavel, MessageSquareWarning, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { can } from "@/lib/auth-shared";
import type { FindingRow, FindingStatus, Role } from "@/lib/types";
import { Button, CLAIM, cx, DECISION, inputCls, ISSUE, Pill, SeverityBadge } from "./ui";

type Mode = null | "dispute" | "override" | "clear";

export function FindingCard({
  f,
  role,
  active,
  busy,
  onSelect,
  onDecide,
}: {
  f: FindingRow;
  role: Role;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
  onDecide: (status: FindingStatus, reason?: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const open = f.status === "open" || f.status === "disputed";
  const isCreator = can(role, "decideFinding");
  const canClear = can(role, "clearClaim") && f.needsReview && open;
  const canOverride = can(role, "overrideBlocker") && f.severity === "blocker" && open;

  const submit = async () => {
    const status: FindingStatus = mode === "dispute" ? "disputed" : mode === "override" ? "overridden" : "cleared";
    if (await onDecide(status, reason.trim() || undefined)) {
      setMode(null);
      setReason("");
    }
  };

  return (
    <motion.article
      layout="position"
      id={`finding-${f.id}`}
      onClick={onSelect}
      className={cx(
        "cursor-pointer rounded-2xl border bg-white p-4 transition-[border-color,box-shadow,opacity] duration-200",
        active ? "border-navy shadow-lift" : "border-line shadow-soft hover:border-sky-300",
        !open && !active && "opacity-75"
      )}
    >
      <header className="flex flex-wrap items-center gap-1.5">
        <SeverityBadge s={f.severity} />
        <Pill className="bg-white text-muted ring-line">{ISSUE[f.type]}</Pill>
        {f.claimStatus && <Pill className={cx("ring-transparent", CLAIM[f.claimStatus].cls)}>{CLAIM[f.claimStatus].label}</Pill>}
        {f.ai && (
          <Pill className="bg-white text-muted ring-line" >
            <Bot className="size-3" /> AI · {Math.round(f.confidence * 100)}%
          </Pill>
        )}
        {f.needsReview && open && (
          <Pill className="bg-sky-600 text-white ring-transparent">
            <ShieldCheck className="size-3" /> Needs reviewer
          </Pill>
        )}
        {!open && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-mint-700">
            <Check className="size-3.5" /> {DECISION[f.status]}
          </span>
        )}
      </header>

      <p className="mt-3 font-serif text-[19px] leading-snug text-navy">
        {f.start >= 0 ? <>“{f.quote}”</> : <span className="text-[17px]">Image · {f.quote}</span>}
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink">{f.message}</p>

      {f.fix && (
        <div className="mt-3 rounded-xl bg-mint-50/70 px-3 py-2 text-sm">
          <span className="kicker !text-mint-700">Suggested fix</span>
          <p className="mt-0.5 text-navy">
            {f.start >= 0 && <del className="mr-1.5 text-muted decoration-coral/60">{f.quote}</del>}
            <ins className="font-medium text-mint-700 no-underline">{f.fix}</ins>
          </p>
          {f.fixBreaksIntent && (
            <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
              <AlertTriangle className="size-3.5" /> This fix may drop part of your key message. Edit it by hand instead.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 border-t border-hair pt-3 text-xs text-muted">
        <BookOpen className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
        <p>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-sky-700">{f.cites.label}</span> — {f.cites.excerpt}
        </p>
      </div>

      {f.reason && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs text-ink">
          <MessageSquareWarning className="mt-0.5 size-3.5 shrink-0 text-sky-600" />
          <span>
            <b className="font-medium capitalize text-navy">{f.decidedBy}:</b> {f.reason}
          </span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
        {open && isCreator && (
          <>
            {f.fix && !f.fixBreaksIntent && f.start >= 0 && (
              <Button size="sm" variant="success" loading={busy} icon={<Check className="size-3.5" />} onClick={() => onDecide("accepted")}>
                Accept fix
              </Button>
            )}
            {f.fix && (f.start < 0 || f.fixBreaksIntent) && (
              <Button size="sm" variant="secondary" loading={busy} icon={<Check className="size-3.5" />} onClick={() => onDecide("accepted")}>
                Mark fixed
              </Button>
            )}
            {!f.fix && (
              <Button size="sm" variant="secondary" loading={busy} icon={<Check className="size-3.5" />} onClick={() => onDecide("accepted")}>
                I&apos;ll fix it
              </Button>
            )}
            {f.severity !== "blocker" && (
              <Button size="sm" variant="ghost" disabled={busy} icon={<X className="size-3.5" />} onClick={() => onDecide("dismissed")}>
                Dismiss
              </Button>
            )}
            {f.status !== "disputed" && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setMode(mode === "dispute" ? null : "dispute")}>
                Dispute
              </Button>
            )}
          </>
        )}
        {canClear && (
          <Button size="sm" variant="primary" disabled={busy} icon={<ShieldCheck className="size-3.5" />} onClick={() => setMode(mode === "clear" ? null : "clear")}>
            Clear claim
          </Button>
        )}
        {canOverride && (
          <Button size="sm" variant="danger" disabled={busy} icon={<Gavel className="size-3.5" />} onClick={() => setMode(mode === "override" ? null : "override")}>
            Override
          </Button>
        )}
        {!open && (isCreator || (f.status === "cleared" && can(role, "clearClaim")) || (f.status === "overridden" && canOverrideAny(role))) && (
          <Button size="sm" variant="ghost" disabled={busy} icon={<RotateCcw className="size-3.5" />} onClick={() => onDecide("open")}>
            Undo
          </Button>
        )}
        {open && !isCreator && !canClear && !canOverride && (
          <p className="text-xs text-muted">Read-only as {role}. The creator decides this one.</p>
        )}
      </div>

      <AnimatePresence initial={false}>
        {mode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3 grid gap-2">
              <textarea
                autoFocus
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={inputCls}
                placeholder={
                  mode === "dispute"
                    ? "Why is this wrong? e.g. “This figure is from the Oct campaign brief.”"
                    : mode === "override"
                      ? "Reason for publishing anyway (goes in the audit log)"
                      : "Optional: how you verified it, e.g. “Checked with Ops, still true.”"
                }
              />
              <div className="flex gap-1.5">
                <Button size="sm" variant={mode === "override" ? "danger" : "primary"} loading={busy} onClick={submit}>
                  {mode === "dispute" ? "Send dispute" : mode === "override" ? "Override blocker" : "Mark verified"}
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

function canOverrideAny(role: Role) {
  return can(role, "overrideBlocker");
}
