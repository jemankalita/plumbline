"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AiHealth } from "@/app/api/ai/status/route";
import { api, cx } from "./ui";

const shortModel = (name: string | null) => name?.split("·").pop()?.trim() ?? "";

const CACHE_KEY = "plumbline.aiHealth";
const CACHE_MS = 10 * 60 * 1000; // each test spends quota, so one browser tests at most this often
const BUSY_NOTE = "AI checks may be slower or skipped. Plain-code checks still work.";

function readCached(): AiHealth | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as { at: number; health: AiHealth } | null;
    return saved && Date.now() - saved.at < CACHE_MS ? saved.health : null;
  } catch {
    return null;
  }
}

function remember(health: AiHealth): AiHealth {
  try {
    if (health.ok) sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), health }));
  } catch {
    // Without browser storage the sidebar simply tests again next time.
  }
  return health;
}

const fetchHealth = () => api<AiHealth>("/api/ai/status").then(remember);

/** Sidebar line that reports a real test call to the model, not just whether a key exists. */
export function AiStatus({ configured }: { configured: boolean }) {
  const [health, setHealth] = useState<AiHealth | null>(null);
  const [testing, setTesting] = useState(configured);

  const test = useCallback(async () => {
    setTesting(true);
    try {
      setHealth(await fetchHealth());
    } catch {
      setHealth({ configured, ok: false, model: null, ms: 0, error: BUSY_NOTE });
    } finally {
      setTesting(false);
    }
  }, [configured]);

  useEffect(() => {
    if (!configured) return;
    let live = true;
    const cached = readCached();
    (cached ? Promise.resolve(cached) : fetchHealth())
      .then((h) => live && setHealth(h))
      .catch(() => live && setHealth({ configured, ok: false, model: null, ms: 0, error: BUSY_NOTE }))
      .finally(() => live && setTesting(false));
    return () => {
      live = false;
    };
  }, [configured]);

  const on = !!health?.ok;
  const failed = !!health && !health.ok && configured;
  const label = !configured ? "AI off: no API key" : testing ? "Testing AI…" : on ? "AI working" : "AI is busy";

  return (
    <div className="grid gap-1" aria-live="polite">
      <div className="flex items-center gap-2 text-ash-300">
        {testing ? (
          <Loader2 className="size-3 animate-spin" aria-hidden />
        ) : (
          <span className={cx("size-1.5 rounded-full", on ? "bg-lime" : failed ? "bg-amber" : "bg-ash-600")} aria-hidden />
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
