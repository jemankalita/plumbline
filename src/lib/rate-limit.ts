// Protects the Gemini quota from a single busy client. With Supabase, counts are shared by every
// server instance (see enforceLimits). Without it, or if the database call fails, each process counts here.

export interface LimitRule {
  limit: number;
  windowMs: number;
}

const MINUTE = 60_000;
export const LIMITS = {
  publicCheck: { limit: 12, windowMs: 10 * MINUTE },
  publicCheckAll: { limit: 300, windowMs: 24 * 60 * MINUTE },
  saveVersion: { limit: 30, windowMs: 10 * MINUTE },
  videoRead: { limit: 8, windowMs: 10 * MINUTE },
  parseFile: { limit: 20, windowMs: 10 * MINUTE },
  kitImport: { limit: 5, windowMs: 10 * MINUTE },
} satisfies Record<string, LimitRule>;

const MAX_KEYS = 5000;
const SLOT = Symbol.for("plumbline.rateLimits");
const slots = globalThis as unknown as Record<symbol, Map<string, number[]> | undefined>;
const hits = (): Map<string, number[]> => (slots[SLOT] ??= new Map());

export const clearLimits = () => hits().clear();

/** Records a request and says whether it is within the limit. */
export function checkLimit(key: string, rule: LimitRule, now = Date.now()): boolean {
  const recent = (hits().get(key) ?? []).filter((t) => now - t < rule.windowMs);
  if (recent.length >= rule.limit) {
    hits().set(key, recent);
    return false;
  }
  if (hits().size >= MAX_KEYS) hits().delete(hits().keys().next().value as string);
  hits().set(key, [...recent, now]);
  return true;
}

export function clientKey(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
