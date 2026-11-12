import { z } from "zod";
import { BadRequest, handle, NotFound, ok, parseBody } from "@/lib/api";
import { currentSession, requireSession, type Action } from "@/lib/auth";
import { getFinding, updateFinding } from "@/lib/db/repo";

const body = z.object({
  status: z.enum(["open", "accepted", "dismissed", "disputed", "cleared", "overridden"]),
  reason: z.string().trim().max(500).nullish(),
  reasonCode: z.enum(["wrong", "valid_but_exception", "rule_outdated", "not_useful"]).nullish(),
});

const ACTION: Record<z.infer<typeof body>["status"], Action> = {
  open: "decideFinding",
  accepted: "decideFinding",
  dismissed: "decideFinding",
  disputed: "decideFinding",
  cleared: "clearClaim",
  overridden: "overrideBlocker",
};

/** Decide one finding. Every decision is logged and feeds Insights and the Gap Finder. */
export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/findings/[id]">) => {
  const { id } = await ctx.params;
  const { status, reason, reasonCode } = await parseBody(req, body);
  const finding = await getFinding((await currentSession()).kitId, id);
  if (!finding) throw new NotFound("Finding not found.");

  // reopening is allowed for whoever can make the decision that is being undone
  const action = status === "open" ? ACTION[finding.status] ?? "decideFinding" : ACTION[status];
  const { kitId, role } = await requireSession(action);

  if (status === "dismissed" && finding.severity === "blocker") {
    throw new BadRequest("Blockers can't be dismissed. Dispute it, fix it, or ask an approver to override.");
  }
  if (status === "dismissed" && !reasonCode) throw new BadRequest("Pick a reason, so the team can learn from it.");
  if (status === "disputed" && (!reason || reason.length < 5)) throw new BadRequest("Say why you disagree, so the reviewer can check.");
  if (status === "overridden") {
    if (finding.severity !== "blocker") throw new BadRequest("Only blockers need an override. Dismiss others instead.");
    if (!reason || reason.length < 10) throw new BadRequest("An override needs a written reason (10+ characters). It goes in the audit log.");
  }
  if (status === "cleared" && !finding.needsReview) throw new BadRequest("Only routed items can be cleared by a reviewer.");

  const updated = await updateFinding(kitId, id, status, role, reason ?? null, status === "dismissed" ? reasonCode ?? null : null);
  if (!updated) throw new NotFound("Finding not found.");
  return ok(updated);
});
