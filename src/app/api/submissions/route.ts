import { clientKey, LIMITS } from "@/lib/rate-limit";
import { geminiProvider } from "@/lib/ai/gemini";
import { storedProvider } from "@/lib/db/stored-ai";
import { draftSchema, handle, ok, parseBody, enforceLimits, requireContent } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { createSubmission, getKit } from "@/lib/db/repo";
import { runReview } from "@/lib/engine";

export const maxDuration = 60;

/** Create a submission: run the full review on v1 and save it with its findings. */
export const POST = handle(async (req: Request) => {
  const { kitId, role } = await requireSession("submit");
  const body = await parseBody(req, draftSchema);
  await enforceLimits([`save:${clientKey(req)}`, LIMITS.saveVersion]);
  requireContent(body);
  const kit = await getKit(kitId);
  const result = await runReview({
    text: body.text,
    kit,
    image: body.image ?? null,
    video: body.video ?? null,
    keyMessage: body.keyMessage ?? null,
    channel: body.channel,
    provider: storedProvider(geminiProvider()),
  });
  const sub = await createSubmission(
    kit,
    {
      title: body.title,
      channel: body.channel,
      aiAssisted: body.aiAssisted,
      keyMessage: body.keyMessage || null,
      text: body.text,
      image: body.image ?? null,
    },
    result,
    role
  );
  return ok({ id: sub.id, score: result.score, findings: result.findings.length }, { status: 201 });
});
