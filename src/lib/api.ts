// Shared helpers for route handlers: one error envelope, schema validation, role checks.

import { z } from "zod";
import { ForbiddenError } from "./auth";
import { ConflictError } from "./db/store";

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
    thumbnail: z
      .string()
      .max(400_000)
      .regex(/^data:image\/(png|jpeg|webp);base64,/)
      .nullish(),
  })
  .nullish();

export const draftSchema = z.object({
  title: z.string().trim().min(1, "Give the draft a title").max(140),
  channel: z.string().trim().min(1).max(40),
  aiAssisted: z.boolean(),
  keyMessage: z.string().trim().max(200).nullish(),
  text: z.string().trim().min(1, "Paste or upload some content").max(20000),
  image: imageSchema,
});

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
