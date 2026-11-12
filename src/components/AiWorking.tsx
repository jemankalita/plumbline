"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cx } from "./ui";

const TICK_MS = 1000;
/** How long each item in the list stays highlighted. */
const FOCUS_SECONDS = 3;
/** After this long, say plainly that the check is still alive and what happens if AI is slow. */
const SLOW_SECONDS = 40;

/**
 * Shown while a check runs, so a long AI read never looks frozen.
 * It claims no progress the server has not reported: the list is what the check covers,
 * the highlight only shows the page is alive, and the clock is real.
 */
export function AiWorking({
  title,
  checks,
  images = [],
  imageNote,
  hint,
  slowNote = "Still working. If AI is slow, the check finishes without it and says so.",
  className,
}: {
  title: string;
  checks: string[];
  /** Pictures being checked: one image, or the frames taken from a video. */
  images?: string[];
  imageNote?: string;
  hint?: string;
  slowNote?: string;
  className?: string;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setSeconds((s) => s + 1), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const focus = Math.floor(seconds / FOCUS_SECONDS) % Math.max(1, checks.length);
  const shown = images.length ? images[seconds % images.length] : null;

  return (
    <div role="status" aria-live="polite" className={cx("grid gap-3", className)}>
      {shown && (
        <div className="relative overflow-hidden rounded-md bg-soot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shown} alt="" className="max-h-[220px] w-full object-cover opacity-80" />
          <span className="scan-line" aria-hidden />
          {imageNote && <span className="absolute bottom-2 left-2 rounded bg-soot/85 px-1.5 py-0.5 text-[12px] text-white">{imageNote}</span>}
        </div>
      )}
      <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        <span className="min-w-0 flex-1">{title}</span>
        <span className="num shrink-0 text-[13px] font-normal text-muted" aria-label={`${seconds} seconds so far`}>
          {seconds} s
        </span>
      </p>
      {checks.length > 0 && (
        <ul className="grid gap-1 text-[14px]" aria-label="What this check covers">
          {checks.map((c, i) => (
            <li key={c} className={cx("flex items-center gap-2 transition-colors duration-300", i === focus ? "text-ink" : "text-muted")}>
              <span className={cx("size-1.5 shrink-0 rounded-full transition-colors duration-300", i === focus ? "bg-ink" : "bg-ash-300")} aria-hidden />
              {c}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[13px] text-muted">{seconds >= SLOW_SECONDS ? slowNote : hint}</p>
    </div>
  );
}
