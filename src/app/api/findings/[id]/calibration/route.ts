import { handle, NotFound, ok } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { keepRuleAtFullStrength } from "@/lib/db/repo";

/** Undo what the team's decisions changed about this check, and leave the rule alone for 30 days. */
export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/findings/[id]/calibration">) => {
  const { id } = await ctx.params;
  const { kitId, role } = await requireSession("decideFinding");
  const pinned = await keepRuleAtFullStrength(kitId, id, role);
  if (!pinned) throw new NotFound("Finding not found.");
  return ok(pinned);
});
