/** Plain-English names for the dotted event codes stored in the audit log. */

const EXACT: Record<string, string> = {
  "submission.created": "Draft checked",
  "revision.created": "New version checked",
  "kit.updated": "Brand Kit edited",
  "learning.undone": "Learning undone",
  "ai.judgement": "AI tone check",
  "ai.image": "AI image check",
  "ai.video": "AI video read",
  "finding.accepted": "Fix accepted",
  "finding.dismissed": "Issue dismissed",
  "finding.disputed": "Issue disputed",
  "finding.cleared": "Issue cleared",
  "finding.overridden": "Overridden",
  "finding.open": "Issue reopened",
  "status.draft": "Back to draft",
  "status.in_review": "Sent for approval",
  "status.changes_requested": "Changes requested",
  "status.approved": "Approved",
};

const KIT_KIND: Record<string, string> = { rules: "Rule", rule: "Rule", facts: "Fact", fact: "Fact", terms: "Term", term: "Term", examples: "Example", example: "Example" };
const KIT_VERB: Record<string, string> = { added: "added", updated: "edited", deleted: "removed" };

export function auditLabel(action: string): string {
  if (EXACT[action]) return EXACT[action];
  const [scope, kind, verb] = action.split(".");
  if (scope === "kit" && kind && verb) return `${KIT_KIND[kind] ?? "Brand Kit item"} ${KIT_VERB[verb] ?? verb}`;
  const last = action.split(".").pop() ?? action;
  const words = last.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Older rows were written as "11 finding(s)"; show them with real plurals. */
export function tidyDetail(detail: string): string {
  return detail.replace(/(\d+) (\w+)\(s\)/g, (_, n: string, word: string) => `${n} ${word}${n === "1" ? "" : "s"}`);
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
