import { DEFAULT_KIT_ID } from "@/lib/auth-shared";
import { z } from "zod";
import { geminiProvider } from "@/lib/ai/gemini";
import { storedProvider } from "@/lib/db/stored-ai";
import { enforceLimits, handle, imageSchema, ok, parseBody, requireContent } from "@/lib/api";
import { getKit } from "@/lib/db/repo";
import { runReview } from "@/lib/engine";
import { clientKey, LIMITS } from "@/lib/rate-limit";

export const maxDuration = 60;

const body = z.object({
  text: z.string().trim().max(5000),
  keyMessage: z.string().max(200).nullish(),
  image: imageSchema,
});

/** Stateless check used by the landing-page playground. Nothing is stored. */
export const POST = handle(async (req: Request) => {
  const input = await parseBody(req, body);
  requireContent(input);
  await enforceLimits([`review:${clientKey(req)}`, LIMITS.publicCheck], ["review:all", LIMITS.publicCheckAll]);
  const kit = await getKit(DEFAULT_KIT_ID);
  const result = await runReview({ text: input.text, kit, image: input.image, keyMessage: input.keyMessage, provider: storedProvider(geminiProvider()) });
  return ok(result);
});
