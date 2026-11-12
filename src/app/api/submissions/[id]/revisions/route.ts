import { clientKey, LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import { inputFromReport } from "@/lib/engine/video";
import { geminiProvider } from "@/lib/ai/gemini";
import { storedProvider } from "@/lib/db/stored-ai";
import { handle, imageSchema, videoSchema, NotFound, ok, parseBody, enforceLimits, requireContent } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { addRevision, getKit, getSubmission } from "@/lib/db/repo";
import { runReview } from "@/lib/engine";

export const maxDuration = 60;

const body = z.object({ text: z.string().trim().max(20000), image: imageSchema, video: videoSchema });

/** Save an edited draft as a new revision and review it again from scratch. */
export const POST = handle(async (req: Request, ctx: RouteContext<"/api/submissions/[id]/revisions">) => {
  const { kitId, role } = await requireSession("editDraft");
  const { id } = await ctx.params;
  const input = await parseBody(req, body);
  const detail = await getSubmission(kitId, id);
  if (!detail) throw new NotFound("Submission not found.");
  const previous = detail.revisions[detail.revisions.length - 1];
  const image = input.image === undefined ? previous?.image ?? null : input.image;
  await enforceLimits([`save:${clientKey(req)}`, LIMITS.saveVersion]);
  const video = input.video === undefined ? (previous?.video ? inputFromReport(previous.video) : null) : input.video;
  requireContent({ text: input.text, image, video });
  const kit = await getKit(kitId);
  const result = await runReview({
    text: input.text,
    kit,
    image,
    video,
    keyMessage: detail.submission.keyMessage,
    channel: detail.submission.channel,
    provider: storedProvider(geminiProvider()),
  });
  const rev = await addRevision(kit, id, input.text, image, result, role);
  return ok({ revision: rev.n, score: rev.score });
});
