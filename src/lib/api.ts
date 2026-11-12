import { createHash } from "node:crypto";
import { checkLimit, type LimitRule } from "./rate-limit";
// Shared helpers for route handlers: one error envelope, schema validation, role checks.

import { z } from "zod";
import { ForbiddenError } from "./auth";
import { ConflictError, StorageUnavailable, store } from "./db/store";

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ ok: true, data }, init);
}

export function fail(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequest("Request body must be JSON.");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new BadRequest(`${first.path.join(".") || "body"}: ${first.message}`);
  }
  return result.data;
}

export class BadRequest extends Error {}
export class NotFound extends Error {}
export class TooManyRequests extends Error {}

const BUSY = "That's a lot of checks in a short time. Please wait a few minutes and try again.";

/** Counts a request, shared across instances when the database allows it. Keys are hashed so no IP address is stored. */
async function takeLimit(key: string, rule: LimitRule): Promise<boolean> {
  const db = store();
  if (!db.takeRateLimit) return checkLimit(key, rule);
  try {
    return await db.takeRateLimit(createHash("sha256").update(key).digest("hex"), rule.limit, rule.windowMs);
  } catch (error) {
    console.error("[plumbline] shared rate limit failed, counting locally", error);
    return checkLimit(key, rule);
  }
}

/** Throws a friendly 429 when any of the given limits is used up. */
export async function enforceLimits(...checks: [key: string, rule: LimitRule][]): Promise<void> {
  for (const [key, rule] of checks) {
    if (!(await takeLimit(key, rule))) throw new TooManyRequests(BUSY);
  }
}

/** Wrap a handler so every error becomes a clean JSON response, never a stack trace. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof BadRequest) return fail(400, e.message);
      if (e instanceof ForbiddenError) return fail(403, e.message);
      if (e instanceof NotFound) return fail(404, e.message);
      if (e instanceof ConflictError) return fail(409, e.message);
      if (e instanceof TooManyRequests) return fail(429, e.message);
      if (e instanceof StorageUnavailable) return fail(503, e.message);
      console.error("[plumbline] unhandled", e);
      return fail(500, "Something went wrong on our side. Please try again.");
    }
  };
}

// ---------- schemas ----------

export const imageSchema = z
  .object({
    name: z.string().max(200),
    altText: z.string().max(500).nullish(),
    colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(8),
    colorAreas: z.array(z.object({ hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), share: z.number().min(0).max(1) })).max(12).nullish(),
    thumbnail: z
      .string()
      .max(400_000)
      .regex(/^data:image\/(png|jpeg|webp);base64,/)
      .nullish(),
  })
  .nullish();

const videoBox = z.tuple([z.number(), z.number(), z.number(), z.number()]).nullish();

export const videoSchema = z
  .object({
    name: z.string().max(200),
    durationMs: z.number().int().min(0).max(600_000),
    width: z.number().int().min(1).max(10_000),
    height: z.number().int().min(1).max(10_000),
    sampledEveryMs: z.number().int().min(0).max(600_000),
    sampledMs: z.array(z.number().int().min(0).max(600_000)).max(20).optional(),
    frames: z
      .array(
        z.object({
          ms: z.number().int().min(0).max(600_000),
          thumbnail: z.string().max(40_000).regex(/^data:image\/jpeg;base64,/).nullish(),
          texts: z.array(z.object({ text: z.string().max(200), box: videoBox })).max(15),
          logo: z.object({ aspectDiff: z.number().min(0), colourDelta: z.number().min(0), fgHex: z.string().regex(/^#[0-9a-fA-F]{6}$/), clearSpaceIntrusion: z.number().min(0).max(1) }).nullish(),
        })
      )
      .max(20),
    read: z.object({ status: z.enum(["ran", "failed", "skipped"]), model: z.string().max(120).nullable(), ms: z.number().int().min(0), note: z.string().max(200) }),
  })
  .nullish();

export const draftSchema = z.object({
  title: z.string().trim().min(1, "Give the draft a title").max(140),
  channel: z.string().trim().min(1).max(40),
  aiAssisted: z.boolean(),
  keyMessage: z.string().trim().max(200).nullish(),
  text: z.string().trim().max(20000),
  image: imageSchema,
  video: videoSchema,
});

/** A check needs something to look at: words, a picture or a video. */
export function requireContent(input: { text: string; image?: unknown; video?: unknown }) {
  if (!input.text && !input.image && !input.video) throw new BadRequest("Add some text, an image or a video to check.");
}

export const severity = z.enum(["blocker", "warning", "suggestion"]);
export const category = z.enum(["terminology", "tone", "messaging", "claim", "readability", "accessibility", "visual", "legal"]);

export const ruleSchema = z.object({
  id: z.string().max(40).optional(),
  section: z.string().trim().min(1).max(12),
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(600),
  category,
  severity,
  check: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("pattern"), pattern: z.string().min(1).max(300), flags: z.string().max(6).optional(), fix: z.string().max(120).optional() }),
      z.object({ kind: z.literal("maxSentenceWords"), value: z.number().int().min(5).max(100) }),
      z.object({ kind: z.literal("superlative") }),
      z.object({ kind: z.literal("altText") }),
      z.object({ kind: z.literal("contrast"), min: z.number().min(1).max(21) }),
      z.object({ kind: z.literal("palette"), maxDistance: z.number().min(1).max(100) }),
      z.object({ kind: z.literal("vision") }),
      z.object({ kind: z.literal("videoFormat") }),
      z.object({ kind: z.literal("minOnScreen"), pattern: z.string().min(1).max(300), seconds: z.number().min(0.5).max(30) }),
      z.object({ kind: z.literal("logoDistortion") }),
      z.object({ kind: z.literal("logoColour") }),
      z.object({ kind: z.literal("logoClearSpace") }),
    ])
    .nullish(),
  goodExample: z.string().max(300).nullish(),
  badExample: z.string().max(300).nullish(),
});

export const termSchema = z.object({
  id: z.string().max(40).optional(),
  preferred: z.string().trim().min(1).max(80),
  banned: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  note: z.string().max(200).nullish(),
});

export const factSchema = z.object({
  id: z.string().max(40).optional(),
  statement: z.string().trim().min(1).max(240),
  keywords: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
  value: z.number().nullish(),
  source: z.string().trim().min(1).max(200),
  owner: z.string().trim().min(1).max(80),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});
