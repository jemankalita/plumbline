"use client";

import type { ReactNode } from "react";
import type { FindingRow } from "@/lib/types";
import { cx } from "./ui";

const RANK = { blocker: 0, warning: 1, suggestion: 2 } as const;

/** Text findings that can be drawn without overlapping, most severe winning. */
function layers(findings: FindingRow[]): FindingRow[] {
  const text = findings
    .filter((f) => f.start >= 0 && f.end > f.start)
    .sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.start - b.start);
  const picked: FindingRow[] = [];
  for (const f of text) if (!picked.some((p) => f.start < p.end && f.end > p.start)) picked.push(f);
  return picked.sort((a, b) => a.start - b.start);
}

/** The working text: the revision with every accepted fix applied. */
export function applyAccepted(text: string, findings: FindingRow[]): string {
  const accepted = layers(findings).filter((f) => f.status === "accepted" && f.fix != null);
  let out = "";
  let cursor = 0;
  for (const f of accepted) {
    out += text.slice(cursor, f.start) + f.fix;
    cursor = f.end;
  }
  return out + text.slice(cursor);
}

export function DraftView({
  text,
  findings,
  activeId,
  onSelect,
  className = "text-[19px] sm:text-[20px]",
  fixesOnly = false,
}: {
  text: string;
  findings: FindingRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  className?: string;
  /** Show accepted fixes as the finished sentence, without the struck-out original. */
  fixesOnly?: boolean;
}) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const f of layers(findings)) {
    if (f.start > cursor) parts.push(text.slice(cursor, f.start));
    const quote = text.slice(f.start, f.end);
    const open = f.status === "open" || f.status === "disputed";
    const active = f.id === activeId;
    if (f.status === "accepted" && f.fix != null) {
      parts.push(
        <span key={f.id} className={cx("hl hl-done", active && "hl-active")} onClick={() => onSelect(f.id)}>
          {!fixesOnly && <del className="mr-1 text-muted decoration-red/50">{quote}</del>}
          {f.fix && <ins className="text-green-700 no-underline">{f.fix}</ins>}
        </span>
      );
    } else {
      parts.push(
        <mark
          key={f.id}
          role="button"
          tabIndex={0}
          aria-label={`${f.severity}: ${f.message}`}
          onClick={() => onSelect(f.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(f.id);
            }
          }}
          className={cx(
            "hl text-inherit",
            open ? `hl-${f.severity}` : "bg-transparent underline decoration-muted/40 decoration-dotted underline-offset-4",
            active && "hl-active"
          )}
        >
          {quote}
        </mark>
      );
    }
    cursor = f.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <div className={cx("whitespace-pre-wrap leading-[1.6] text-ink", className)}>{parts}</div>;
}
