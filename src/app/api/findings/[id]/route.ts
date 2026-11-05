import { z } from "zod";
import { BadRequest, handle, NotFound, ok, parseBody } from "@/lib/api";
import { requireRole, type Action } from "@/lib/auth";
import { getFinding, updateFinding } from "@/lib/db/repo";

const body = z.object({
  status: z.enum(["open", "accepted", "dismissed", "disputed", "cleared", "overridden"]),
  reason: z.string().trim().max(500).nullish(),
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
  const { status, reason } = await parseBody(req, body);
  const finding = await getFinding(id);
  if (!finding) throw new NotFound("Finding not found.");

  // reopening is allowed for whoever can make the decision that is being undone
  const action = status === "open" ? ACTION[finding.status] ?? "decideFinding" : ACTION[status];
  const role = await requireRole(action);

  if (status === "dismissed" && finding.severity === "blocker") {
    throw new BadRequest("Blockers can't be dismissed. Dispute it, fix it, or ask an approver to override.");
  }
  if (status === "disputed" && (!reason || reason.length < 5)) throw new BadRequest("Say why you disagree, so the reviewer can check.");
  if (status === "overridden") {
    if (finding.severity !== "blocker") throw new BadRequest("Only blockers need an override. Dismiss others instead.");
    if (!reason || reason.length < 10) throw new BadRequest("An override needs a written reason (10+ characters). It goes in the audit log.");
  }
  if (status === "cleared" && !finding.needsReview) throw new BadRequest("Only routed items can be cleared by a reviewer.");

  const updated = await updateFinding(id, status, role, reason ?? null);
  return ok(updated);
});
