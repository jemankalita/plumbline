import { cookies } from "next/headers";
import { z } from "zod";
import { BadRequest, handle, ok, parseBody } from "@/lib/api";
import { currentSession, encodeSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { isKitId } from "@/lib/auth-shared";

const body = z.object({
  role: z.enum(["creator", "reviewer", "approver", "admin"]),
  kitId: z.string().max(40).optional(),
});

/**
 * Demo sign-in: choose an organisation and role. Every role, Admin included, is open without a code,
 * so judges can try the Brand Kit on their own. The session is still signed, so it can't be forged.
 */
export const POST = handle(async (req: Request) => {
  const { role, kitId } = await parseBody(req, body);
  const session = await currentSession();
  const targetKit = kitId ?? session.kitId;
  if (!isKitId(targetKit)) throw new BadRequest("That organisation doesn't exist.");
  const value = encodeSession({ kitId: targetKit, role });
  if (!value) throw new BadRequest("Demo sign-in isn't set up on this server yet.");
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return ok({ role, kitId: targetKit });
});
