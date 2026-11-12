import { geminiProvider } from "@/lib/ai/gemini";
import { handle, ok } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export interface AiHealth {
  configured: boolean;
  ok: boolean;
  model: string | null;
  ms: number;
  error: string | null;
}

const CACHE_MS = 60_000; // a test costs quota, so repeat clicks reuse the last answer
const PING_TIMEOUT_MS = 12_000;
const PING_DEADLINE_MS = 25_000; // inside this route's maxDuration
const BUSY_NOTE = "AI checks may be slower or skipped. Plain-code checks still work.";

let last: { at: number; health: AiHealth } | null = null;

async function ping(): Promise<AiHealth> {
  const provider = geminiProvider();
  if (!provider) return { configured: false, ok: false, model: null, ms: 0, error: "No API key on this server." };
  const t0 = Date.now();
  try {
    await provider.json('Health check. Reply with JSON only: {"ok":true}', [{ text: "ping" }], { timeoutMs: PING_TIMEOUT_MS, deadlineMs: PING_DEADLINE_MS });
    return { configured: true, ok: true, model: provider.name, ms: Date.now() - t0, error: null };
  } catch (e) {
    console.error("[plumbline] AI health check failed", e); // the provider's wording stays in the server log
    return { configured: true, ok: false, model: null, ms: Date.now() - t0, error: BUSY_NOTE };
  }
}

/** A real round trip to the model, so "AI is working" is a test result and not an assumption. */
export const GET = handle(async () => {
  if (last && Date.now() - last.at < CACHE_MS) return ok(last.health);
  const health = await ping();
  last = { at: Date.now(), health };
  return ok(health);
});
