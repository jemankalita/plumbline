import { geminiProvider } from "@/lib/ai/gemini";
import { draftSchema, handle, ok, parseBody } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createSubmission, getKit } from "@/lib/db/repo";
import { runReview } from "@/lib/engine";

export const maxDuration = 60;

/** Create a submission: run the full review on v1 and save it with its findings. */
export const POST = handle(async (req: Request) => {
  const role = await requireRole("submit");
  const body = await parseBody(req, draftSchema);
  const kit = await getKit();
  const result = await runReview({
    text: body.text,
    kit,
    image: body.image ?? null,
    keyMessage: body.keyMessage ?? null,
    channel: body.channel,
    provider: geminiProvider(),
  });
  const sub = await createSubmission(
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
