import { z } from "zod";
import { BadRequest, handle, NotFound, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { ConflictError } from "@/lib/db/store";
import { getSubmission, setStatus } from "@/lib/db/repo";

const body = z.object({
  action: z.enum(["send", "approve", "request_changes"]),
  note: z.string().trim().max(500).nullish(),
});

/** Workflow gates. Plumbline never publishes: a person moves content forward at every step. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/submissions/[id]/status">) => {
  const { id } = await ctx.params;
  const { action, note } = await parseBody(req, body);
  const detail = await getSubmission(id);
  if (!detail) throw new NotFound("Submission not found.");
  const open = detail.findings.filter((f) => f.status === "open" || f.status === "disputed");

  if (action === "send") {
    const role = await requireRole("submit");
    await setStatus(id, "in_review", role, note ?? null);
  }
  if (action === "approve") {
    const role = await requireRole("approve");
    const blockers = open.filter((f) => f.severity === "blocker");
    if (blockers.length) {
      throw new ConflictError(
        `${blockers.length} blocker${blockers.length > 1 ? "s are" : " is"} still open. Fix ${blockers.length > 1 ? "them" : "it"} or override with a written reason first.`
      );
    }
    const routed = open.filter((f) => f.needsReview);
    if (routed.length) {
      throw new ConflictError(`${routed.length} claim${routed.length > 1 ? "s need" : " needs"} a reviewer to clear ${routed.length > 1 ? "them" : "it"} first.`);
    }
    const warnings = open.filter((f) => f.severity === "warning").length;
    await setStatus(id, "approved", role, warnings ? `${warnings} warning(s) acknowledged.` : note ?? null);
  }
  if (action === "request_changes") {
    const role = await requireRole("approve");
    if (!note || note.length < 5) throw new BadRequest("Tell the creator what to change.");
    await setStatus(id, "changes_requested", role, note);
  }
  return ok({ id });
});
