import { cookies } from "next/headers";
import { z } from "zod";
import { handle, ok, parseBody } from "@/lib/api";
import { ROLE_COOKIE } from "@/lib/auth";

const body = z.object({ role: z.enum(["creator", "reviewer", "approver", "admin"]) });

/** Demo sign-in: switch the acting role. */
export const POST = handle(async (req: Request) => {
  const { role } = await parseBody(req, body);
  (await cookies()).set(ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return ok({ role });
});
