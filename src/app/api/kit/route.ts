import { z } from "zod";
import { BadRequest, factSchema, handle, ok, parseBody, ruleSchema, termSchema } from "@/lib/api";
import { currentSession, requireSession } from "@/lib/auth";
import { patternProblem } from "@/lib/engine/regex-safety";
import { deleteKitItem, getKit, nextId, updateKitMeta, upsertKitItem, type KitItemKind } from "@/lib/db/repo";
import type { Fact, Rule, Term } from "@/lib/types";

export const GET = handle(async () => ok(await getKit((await currentSession()).kitId)));

const meta = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  voice: z.string().trim().min(1).max(1000).optional(),
  palette: z
    .array(z.object({ name: z.string().trim().min(1).max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
    .max(16)
    .optional(),
});

export const PATCH = handle(async (req: Request) => {
  const { kitId, role } = await requireSession("editKit");
  const patch = await parseBody(req, meta);
  await updateKitMeta(kitId, patch, role);
  return ok(await getKit(kitId));
});

const item = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rules"), item: ruleSchema }),
  z.object({ kind: z.literal("terms"), item: termSchema }),
  z.object({ kind: z.literal("facts"), item: factSchema }),
]);

export const POST = handle(async (req: Request) => {
  const { kitId, role } = await requireSession("editKit");
  const { kind, item: raw } = await parseBody(req, item);
  if (kind === "rules" && raw.check && "pattern" in raw.check) {
    const problem = patternProblem(raw.check.pattern, raw.check.kind === "pattern" ? (raw.check.flags ?? "gi") : "i");
    if (problem) throw new BadRequest(problem);
  }
  const id = raw.id || (await nextId(kitId, kind));
  await upsertKitItem(kitId, kind, { ...raw, id } as Rule | Term | Fact, role);
  return ok(await getKit(kitId));
});

const kinds = z.enum(["rules", "terms", "facts"]);

export const DELETE = handle(async (req: Request) => {
  const { kitId, role } = await requireSession("editKit");
  const url = new URL(req.url);
  const kind = kinds.safeParse(url.searchParams.get("kind"));
  const id = url.searchParams.get("id");
  if (!kind.success || !id) throw new BadRequest("kind and id are required.");
  await deleteKitItem(kitId, kind.data as KitItemKind, id, role);
  return ok(await getKit(kitId));
});
