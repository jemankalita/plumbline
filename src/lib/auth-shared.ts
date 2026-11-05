// Roles and the permission matrix (Round 1 plan, Fig. 10b). Safe to import in client and server code.
// The server enforces it on every action; the UI uses it only to hide buttons a role can't use.

import type { Role } from "./types";

export const ROLES: { id: Role; name: string; person: string; blurb: string }[] = [
  { id: "creator", name: "Creator", person: "Aanya · content writer", blurb: "Writes drafts, fixes or disputes findings, sends for approval." },
  { id: "reviewer", name: "Reviewer", person: "Kabir · legal & claims", blurb: "Clears claims and low-confidence items routed for checking." },
  { id: "approver", name: "Approver", person: "Meera · brand manager", blurb: "Approves, requests changes, can override a blocker with a reason." },
  { id: "admin", name: "Admin", person: "Dev · brand ops", blurb: "Owns the Brand Kit: rules, terms, facts and palette." },
];

export type Action =
  | "submit"
  | "editDraft"
  | "decideFinding"
  | "clearClaim"
  | "overrideBlocker"
  | "approve"
  | "editKit"
  | "viewInsights";

const MATRIX: Record<Action, Role[]> = {
  submit: ["creator", "admin"],
  editDraft: ["creator", "admin"],
  decideFinding: ["creator", "admin"],
  clearClaim: ["reviewer", "approver", "admin"],
  overrideBlocker: ["approver"],
  approve: ["approver"],
  editKit: ["admin"],
  viewInsights: ["creator", "reviewer", "approver", "admin"],
};

export function can(role: Role, action: Action): boolean {
  return MATRIX[action].includes(role);
}

export function isRole(v: unknown): v is Role {
  return v === "creator" || v === "reviewer" || v === "approver" || v === "admin";
}
