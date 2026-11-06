"use client";

import { CheckCircle2, CircleSlash, RefreshCw, TriangleAlert } from "lucide-react";
import type { AiCall, AiDisclosure } from "@/lib/types";
import { Button, cx } from "../ui";

const PASS_NAME: Record<AiCall["pass"], string> = { judgement: "Tone and messaging", image: "Image brand check" };

const STATE: Record<AiCall["status"], { word: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ran: { word: "AI ran", cls: "bg-lime text-soot", Icon: CheckCircle2 },
  failed: { word: "AI failed", cls: "bg-red-50 text-red-700", Icon: TriangleAlert },
  skipped: { word: "AI not used", cls: "bg-ash-100 text-ash-700", Icon: CircleSlash },
};

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** Plain summary line for the panel header. */
export function aiSummary(ai: AiDisclosure): string {
  const calls = ai.calls ?? [];
  const ran = calls.filter((c) => c.status === "ran").map((c) => (c.pass === "image" ? "the image" : "the text"));
  const failed = calls.filter((c) => c.status === "failed").length;
  if (failed) return `AI failed on ${failed} of ${calls.length} checks`;
  if (ran.length) return `AI checked ${ran.join(" and ")}`;
  return "No AI used on this version";
}

function CallRow({ call }: { call: AiCall }) {
  const { word, cls, Icon } = STATE[call.status];
  return (
    <li className="grid gap-1 border-t border-hair px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12.5px] font-medium", cls)}>
          <Icon className="size-3" aria-hidden /> {word}
        </span>
        <span className="text-[14px] font-medium text-ink">{PASS_NAME[call.pass]}</span>
        {call.status !== "skipped" && <span className="num ml-auto text-[13px] text-muted">{seconds(call.ms)}</span>}
      </div>
      {call.model && <p className="text-[13px] text-muted">Model: {call.model}</p>}
      {call.status !== "skipped" && <p className="text-[13px] text-muted">Sent: {call.sent}</p>}
      <p className="text-[13px] text-ink">{call.status === "skipped" ? call.returned : `Came back: ${call.returned}`}</p>
    </li>
  );
}

export function AiActivity({ ai, canRun, busy, onRun }: { ai: AiDisclosure; canRun: boolean; busy: boolean; onRun: () => void }) {
  const calls = ai.calls ?? [];
  const usedAi = calls.some((c) => c.status === "ran");
  return (
    <div>
      {calls.length ? (
        <ul>
          {calls.map((c) => (
            <CallRow key={c.pass} call={c} />
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[13px] text-muted">{ai.note}</p>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-hair bg-ash-50/60 px-4 py-2.5">
        <p className="min-w-[200px] flex-1 text-[13px] text-muted">Brand terms, claims, colours and alt text are always checked by plain code. They never need AI.</p>
        {canRun && (
          <Button size="sm" variant={usedAi ? "ghost" : "primary"} loading={busy} icon={<RefreshCw className="size-3.5" />} onClick={onRun}>
            {usedAi ? "Check again" : "Run AI check"}
          </Button>
        )}
      </div>
    </div>
  );
}
