// Server side of auth. Demo sign-in: a role switcher sets an httpOnly cookie.
// Production swaps this for Supabase Auth; the permission matrix stays the same.

import "server-only";
import { cookies } from "next/headers";
import type { Role } from "./types";
import { can, isRole, type Action } from "./auth-shared";

export { ROLES, can, isRole, type Action } from "./auth-shared";

export const ROLE_COOKIE = "pl_role";

export async function currentRole(): Promise<Role> {
  const v = (await cookies()).get(ROLE_COOKIE)?.value;
  return isRole(v) ? v : "creator";
}

export class ForbiddenError extends Error {
  constructor(role: Role, action: Action) {
    super(`Acting as ${role}, you can't do this (${action}). Switch role in the top bar.`);
  }
}

export async function requireRole(action: Action): Promise<Role> {
  const role = await currentRole();
  if (!can(role, action)) throw new ForbiddenError(role, action);
  return role;
}
