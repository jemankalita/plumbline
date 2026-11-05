// Domain types shared by the engine, the data layer and the UI.

export type Severity = "blocker" | "warning" | "suggestion";

export type IssueType =
  | "terminology"
  | "tone"
  | "messaging"
  | "claim"
  | "readability"
  | "accessibility"
  | "visual"
  | "legal";

/** Deterministic checks a rule can carry. Rules without a check are judgement rules (AI pass). */
export type RuleCheck =
  | { kind: "pattern"; pattern: string; flags?: string; fix?: string }
  | { kind: "maxSentenceWords"; value: number }
  | { kind: "superlative" }
  | { kind: "altText" }
  | { kind: "contrast"; min: number }
  | { kind: "palette"; maxDistance: number };

export interface Rule {
  id: string;
  section: string; // e.g. "4.2"
  title: string;
  text: string;
  category: IssueType;
  severity: Severity;
  check?: RuleCheck | null;
  goodExample?: string | null;
  badExample?: string | null;
}

export interface Term {
  id: string;
  preferred: string;
  banned: string[];
  note?: string | null;
}

export interface Fact {
  id: string;
  statement: string; // approved wording, used as the fix
  keywords: string[];
  value?: number | null; // normalised number, e.g. 310000
  source: string;
  owner: string;
  expiresOn?: string | null; // ISO date
}

export interface PaletteColor {
  name: string;
  hex: string;
}

export interface BrandKit {
  id: string;
  name: string;
  voice: string;
  palette: PaletteColor[];
  rules: Rule[];
  terms: Term[];
  facts: Fact[];
}

export type CiteKind = "rule" | "term" | "fact";

export interface Citation {
  kind: CiteKind;
  id: string;
  label: string; // "Rule 4.2", "Term · QuickKart", "Fact F3"
  excerpt: string;
}

export type ClaimStatus = "supported" | "unsupported" | "outdated" | "contradicted";

export type FindingStatus = "open" | "accepted" | "dismissed" | "disputed" | "cleared" | "overridden";

export type Pass = "rules" | "claims" | "judgement" | "image";

export interface Finding {
  id: string;
  pass: Pass;
  type: IssueType;
  severity: Severity;
  start: number; // -1 for image findings
  end: number;
  quote: string;
  message: string;
  cites: Citation;
  fix?: string | null;
  fixBreaksIntent?: boolean;
  confidence: number;
  needsReview: boolean;
  claimStatus?: ClaimStatus | null;
  ai: boolean;
  status: FindingStatus;
  decidedBy?: Role | null;
  reason?: string | null;
}

export interface ClaimResult {
  quote: string;
  start: number;
  end: number;
  status: ClaimStatus;
  factId?: string | null;
}

export interface ImageInput {
  name: string;
  altText?: string | null;
  /** Dominant colours (hex) extracted in the browser, most frequent first. */
  colors: string[];
  /** Small JPEG data URL, used only to draft alt text and for preview. */
  thumbnail?: string | null;
}

export interface AiDisclosure {
  provider: string | null; // e.g. "Google Gemini · gemini-2.5-flash", null when AI was off
  passes: Pass[];
  note: string;
}

export interface ReviewResult {
  findings: Finding[];
  claims: ClaimResult[];
  score: number;
  ai: AiDisclosure;
  dropped: number; // findings rejected by the verifier
  durationMs: number;
}

export type Role = "creator" | "reviewer" | "approver" | "admin";

export type SubmissionStatus = "draft" | "in_review" | "changes_requested" | "approved";

export interface Submission {
  id: string;
  title: string;
  channel: string;
  aiAssisted: boolean;
  keyMessage?: string | null;
  status: SubmissionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Revision {
  id: string;
  submissionId: string;
  n: number;
  text: string;
  image?: ImageInput | null;
  score: number;
  ai: AiDisclosure;
  claims: ClaimResult[];
  dropped: number;
  createdAt: string;
}

export interface FindingRow extends Finding {
  revisionId: string;
  submissionId: string;
}

export interface AuditEntry {
  id: string;
  submissionId: string | null;
  role: Role;
  action: string;
  detail: string;
  at: string;
}
