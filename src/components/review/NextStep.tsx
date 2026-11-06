"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ClipboardCopy, Send, UserRound } from "lucide-react";
import { can } from "@/lib/auth-shared";
import type { Role, SubmissionStatus } from "@/lib/types";
import { Button, cx, inputCls } from "../ui";

const STAGES = ["Checked", "Fix", "Approve"] as const;

function stageOf(status: SubmissionStatus): number {
  if (status === "approved") return 3;
  return status === "in_review" ? 2 : 1;
}

function Stages({ status }: { status: SubmissionStatus }) {
  const current = stageOf(status);
  return (
    <ol className="flex items-center gap-1.5 text-[13px]" aria-label="Progress">
      {STAGES.map((s, i) => {
        const done = i < current;
        return (
          <li key={s} className="flex items-center gap-1.5" aria-current={i === current ? "step" : undefined}>
            {i > 0 && <span className="h-px w-4 bg-ash-300" aria-hidden />}
            <span className={cx("grid size-5 place-items-center rounded-full font-medium", done ? "bg-soot text-lime" : i === current ? "bg-lime text-soot" : "bg-ash-100 text-muted")}>
              {done ? <Check className="size-3" aria-hidden /> : i + 1}
            </span>
            <span className={i === current ? "font-medium text-ink" : "text-muted"}>{s}</span>
          </li>
        );
      })}
    </ol>
  );
}

export interface NextStepProps {
  role: Role;
  status: SubmissionStatus;
  open: number;
  blockers: number;
  routed: number;
  unsaved: number;
  busy: string | null;
  askChanges: boolean;
  setAskChanges: (v: boolean) => void;
  note: string;
  setNote: (v: string) => void;
  copied: boolean;
  onAction: (a: "send" | "approve" | "request_changes") => void;
  onCopy: () => void;
  onSwitchRole: (r: Role) => void;
}

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** One sentence and one main button: what this person should do now. */
export function NextStep(p: NextStepProps) {
  const { role, status, open, blockers, routed, unsaved, busy } = p;
  const switchTo = (r: Role, label: string) => (
    <Button size="sm" variant="secondary" icon={<UserRound className="size-3.5" />} onClick={() => p.onSwitchRole(r)}>
      {label}
    </Button>
  );

  let title: string;
  let detail: string;
  let action: React.ReactNode = null;

  if (status === "approved") {
    title = "Approved for publishing";
    detail = "Plumbline never publishes. Copy the final text into your own tool.";
    action = (
      <Button size="sm" variant="secondary" icon={p.copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />} onClick={p.onCopy}>
        {p.copied ? "Copied" : "Copy final text"}
      </Button>
    );
  } else if (can(role, "approve") && status === "in_review") {
    const held = blockers > 0 || routed > 0;
    title = held ? "Not ready to approve" : "Ready for your sign-off";
    detail = held
      ? [blockers ? `${count(blockers, "blocker")} open` : "", routed ? `${count(routed, "item")} waiting for a reviewer` : ""].filter(Boolean).join(" and ") + ". Override a blocker with a reason, or send it back."
      : "Pre-checked and clear of blockers.";
    action = (
      <>
        <Button size="sm" variant="secondary" onClick={() => p.setAskChanges(!p.askChanges)}>
          Request changes
        </Button>
        <Button size="sm" variant="success" disabled={held} loading={busy === "approve"} icon={<Check className="size-3.5" />} onClick={() => p.onAction("approve")}>
          Approve
        </Button>
      </>
    );
  } else if (can(role, "submit") && (status === "draft" || status === "changes_requested")) {
    title = open ? `Fix or decide ${count(open, "issue")}` : "Everything is decided";
    detail = unsaved ? "Save your fixes first, so the new version gets checked." : open ? "Work through the issues below. You can still send it with some open." : "Send it to an approver when you're ready.";
    action = (
      <Button size="sm" variant={open ? "secondary" : "primary"} disabled={unsaved > 0} loading={busy === "send"} icon={<Send className="size-3.5" />} onClick={() => p.onAction("send")}>
        Send for approval
      </Button>
    );
  } else if (can(role, "submit")) {
    title = "With the approver";
    detail = open ? `${count(open, "issue")} still open. You can keep fixing while it waits.` : "Nothing more to do until they decide.";
    action = can(role, "approve") ? null : switchTo("approver", "View as Approver");
  } else if (can(role, "clearClaim") && routed > 0) {
    title = `${count(routed, "item")} need${routed === 1 ? "s" : ""} checking`;
    detail = "Check each one marked “Needs reviewer” and clear it, or leave it for the creator.";
  } else {
    const waiting = status === "in_review" ? "approver" : "creator";
    title = `Waiting for the ${waiting}`;
    detail = `You're viewing as ${role}, so there is nothing for you to do here.`;
    action = switchTo(waiting as Role, `View as ${waiting === "approver" ? "Approver" : "Creator"}`);
  }

  return (
    <div className="rounded-lg bg-white ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3.5">
        <Stages status={status} />
        <div className="min-w-[220px] flex-1">
          <p className="text-[16px] font-semibold leading-snug text-ink">{title}</p>
          <p className="text-[14px] text-muted">{detail}</p>
        </div>
        {action && <div className="flex flex-wrap gap-1.5">{action}</div>}
      </div>
      <AnimatePresence>
        {p.askChanges && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex flex-col gap-2 border-t border-hair px-4 py-3 sm:flex-row">
              <input autoFocus value={p.note} onChange={(e) => p.setNote(e.target.value)} placeholder="What should the creator change?" aria-label="What should the creator change?" className={inputCls} />
              <Button variant="primary" loading={busy === "request_changes"} onClick={() => p.onAction("request_changes")}>
                Send back
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
