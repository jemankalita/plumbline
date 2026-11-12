// Server side of auth. Demo sign-in: a signed httpOnly cookie says which organisation and role you are using.
// The signature stops anyone from writing their own cookie to become an Approver or reach another organisation.

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Role } from "./types";
import { can, DEFAULT_KIT_ID, isKitId, isRole, type Action } from "./auth-shared";

export { ROLES, ORGS, can, isRole, type Action } from "./auth-shared";

export const SESSION_COOKIE = "pl_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export interface Session {
  kitId: string;
  role: Role;
}

const DEFAULT_SESSION: Session = { kitId: DEFAULT_KIT_ID, role: "creator" };
const LOCAL_ONLY_SECRET = "plumbline-local-development-only";

function secret(): string | null {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;
  return process.env.VERCEL ? null : LOCAL_ONLY_SECRET;
}

const sign = (payload: string, key: string) => createHmac("sha256", key).update(payload).digest("base64url");

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function encodeSession(session: Session): string | null {
  const key = secret();
  if (!key) return null;
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

export function decodeSession(value: string | undefined): Session | null {
  const key = secret();
  if (!key || !value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !sameText(signature, sign(payload, key))) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString());
    const { kitId, role } = parsed as Partial<Session>;
    return isKitId(kitId) && isRole(role) ? { kitId, role } : null;
  } catch {
    return null;
  }
}

export async function currentSession(): Promise<Session> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value) ?? DEFAULT_SESSION;
}

export class ForbiddenError extends Error {
  constructor(role: Role, action: Action) {
    super(`Acting as ${role}, you can't do this (${action}). Switch role in the top bar.`);
  }
}

export async function requireSession(action: Action): Promise<Session> {
  const session = await currentSession();
  if (!can(session.role, action)) throw new ForbiddenError(session.role, action);
  return session;
}
