"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const KEY = "plumbline.firstRunDone";
const subscribe = () => () => {};

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** A short path through the product for someone seeing it for the first time. */
export function FirstRun({ firstDraftId }: { firstDraftId: string | null }) {
  const dismissed = useSyncExternalStore(subscribe, wasDismissed, () => true);
  const [closed, setClosed] = useState(false);
  if (dismissed || closed || !firstDraftId) return null;

  const close = () => {
    setClosed(true);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      // Private windows can refuse storage. The guide simply returns next visit.
    }
  };

  return (
    <aside className="relative rounded-2xl border border-ash-300 bg-white p-5 pr-12">
      <p className="kicker">Try it as a judge · 3 minutes</p>
      <ol className="mt-2 grid list-inside list-decimal gap-1 text-[15px] text-ink">
        <li>Open the Diwali draft and see what was flagged, and why.</li>
        <li>Accept a fix, or say a finding is not an issue and pick a reason.</li>
        <li>Switch role at the top to Approver and try to approve it. Blockers stop you.</li>
      </ol>
      <Link href={`/s/${firstDraftId}`} className="mt-3 inline-flex items-center gap-1 text-[15px] font-medium text-ink underline underline-offset-2">
        Open the draft <ArrowRight className="size-4" aria-hidden />
      </Link>
      <button type="button" onClick={close} aria-label="Hide this guide" className="absolute right-3 top-3 grid size-11 place-items-center rounded-md text-muted hover:bg-ash-100 hover:text-ink">
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  );
}
