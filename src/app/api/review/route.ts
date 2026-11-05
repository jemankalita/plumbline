import { z } from "zod";
import { geminiProvider } from "@/lib/ai/gemini";
import { handle, imageSchema, ok, parseBody } from "@/lib/api";
import { getKit } from "@/lib/db/repo";
import { runReview } from "@/lib/engine";

export const maxDuration = 60;

const body = z.object({
  text: z.string().trim().min(1, "Type or paste something to check").max(5000),
  keyMessage: z.string().max(200).nullish(),
  image: imageSchema,
});

/** Stateless check used by the landing-page playground. Nothing is stored. */
export const POST = handle(async (req: Request) => {
  const input = await parseBody(req, body);
  const kit = await getKit();
  const result = await runReview({ text: input.text, kit, image: input.image, keyMessage: input.keyMessage, provider: geminiProvider() });
  return ok(result);
});
