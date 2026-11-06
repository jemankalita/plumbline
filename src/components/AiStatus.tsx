"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AiHealth } from "@/app/api/ai/status/route";
import { api, cx } from "./ui";

const shortModel = (name: string | null) => name?.split("·").pop()?.trim() ?? "";

/** Sidebar line that reports a real test call to the model, not just whether a key exists. */
export function AiStatus({ configured }: { configured: boolean }) {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [testing, setTesting] = useState(configured);

  const test = useCallback(async () => {
    setTesting(true);
    try {
      setHealth(await api<AiHealth>("/api/ai/status"));
    } catch (e) {
      setHealth({ configured, ok: false, model: null, ms: 0, error: (e as Error).message });
    } finally {
      setTesting(false);
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let live = true;
    api<AiHealth>("/api/ai/status")
      .then((h) => live && setHealth(h))
      .catch((e: Error) => live && setHealth({ configured, ok: false, model: null, ms: 0, error: e.message }))
      .finally(() => live && setTesting(false));
    return () => {
      live = false;
    };
  }, [configured]);

  const on = !!health?.ok;
  const failed = !!health && !health.ok && configured;
  const label = !configured ? "AI off: no API key" : testing ? "Testing AI…" : on ? "AI working" : "AI not responding";

  return (
    <div className="grid gap-1" aria-live="polite">
      <div className="flex items-center gap-2 text-ash-300">
        {testing ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <span className={cx("size-1.5 rounded-full", on ? "bg-lime" : failed ? "bg-red" : "bg-ash-600")} aria-hidden />
        )}
        <span className="font-medium text-white">{label}</span>
        {configured && !testing && (
          <button onClick={test} className="ml-auto grid size-6 place-items-center rounded text-ash-300 hover:bg-soot-3 hover:text-white" aria-label="Test AI again" title="Test AI again">
            <RefreshCw className="size-3" />
          </button>
        )}
      </div>
      {on && (
        <p className="pl-3.5 text-ash-400">
          {shortModel(health.model)} · {(health.ms / 1000).toFixed(1)} s
        </p>
      )}
      {failed && <p className="pl-3.5 text-ash-400">{health.error}</p>}
    </div>
  );
}
