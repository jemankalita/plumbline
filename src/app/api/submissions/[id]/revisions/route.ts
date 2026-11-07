import { clientKey, LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import { geminiProvider } from "@/lib/ai/gemini";
import { handle, imageSchema, NotFound, ok, parseBody, enforceLimits, requireContent } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { addRevision, getKit, getSubmission } from "@/lib/db/repo";
import { runReview } from "@/lib/engine";

export const maxDuration = 60;

const body = z.object({ text: z.string().trim().max(20000), image: imageSchema });

/** Save an edited draft as a new revision and review it again from scratch. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/submissions/[id]/revisions">) => {
  const role = await requireRole("editDraft");
  const { id } = await ctx.params;
  const input = await parseBody(req, body);
  const detail = await getSubmission(id);
  if (!detail) throw new NotFound("Submission not found.");
  const previous = detail.revisions[detail.revisions.length - 1];
  const image = input.image === undefined ? previous?.image ?? null : input.image;
  enforceLimits([`save:${clientKey(req)}`, LIMITS.saveVersion]);
  requireContent({ text: input.text, image });
  const kit = await getKit();
  const result = await runReview({
    text: input.text,
    kit,
    image,
    keyMessage: detail.submission.keyMessage,
    channel: detail.submission.channel,
    provider: geminiProvider(),
  });
  const rev = await addRevision(id, input.text, image, result, role);
  return ok({ revision: rev.n, score: result.score });
});
