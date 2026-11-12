// Domain types shared by the engine, the data layer and the UI.

import type { LogoReadings } from "./engine/logo";

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
  | { kind: "palette"; maxDistance: number }
  | { kind: "vision" } // judged by the AI image pass, which must look at the picture
  | { kind: "videoFormat" }
  | { kind: "minOnScreen"; pattern: string; seconds: number }
  | { kind: "logoDistortion" }
  | { kind: "logoColour" }
  | { kind: "logoClearSpace" };

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

export interface BrandLogo {
  name: string;
  thumbnail: string; // data URL of the correct logo
  aspect: number;
  fgHex: string;
}

export interface BrandKit {
  id: string;
  name: string;
  voice: string;
  palette: PaletteColor[];
  logos?: BrandLogo[];
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

export type Pass = "rules" | "claims" | "judgement" | "image" | "video";

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
  /** The fix is alt text to store on the image, not text to swap into the draft. */
  altFix?: boolean;
  alt?: boolean; // this finding is about missing alt text
  status: FindingStatus;
  decidedBy?: Role | null;
  reason?: string | null;
  reasonCode?: ReasonCode | null;
  /** Recognises this finding in later versions of the draft. */
  fingerprint?: string | null;
  /** The version this decision was first made on, when it was carried forward. */
  carriedFrom?: number | null;
  /** Time in the video, for findings read from a frame. */
  frameMs?: number | null;
  /** What the team's own decisions changed about this finding, and why. */
  calibration?: FindingCalibration | null;
}

export interface FindingCalibration {
  action: "observe" | "quieten" | "demote";
  note: string;
  baseSeverity: Severity;
  simulated: boolean;
}

/** Why someone said "not an issue". Only `wrong` and `rule_outdated` count as false alarms. */
export type ReasonCode = "wrong" | "valid_but_exception" | "rule_outdated" | "not_useful";

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
  /** Flat colour areas and how much of the image each covers. */
  colorAreas?: { hex: string; share: number }[] | null;
  /** Small JPEG data URL, used only to draft alt text and for preview. */
  thumbnail?: string | null;
}

export type VideoTextBox = [number, number, number, number]; // ymin, xmin, ymax, xmax, each 0–1000

export interface VideoFrame {
  ms: number;
  thumbnail?: string | null;
  texts: { text: string; box?: VideoTextBox | null }[];
  /** What code measured on the logo in this frame, when there was one. */
  logo?: LogoReadings | null;
}

/** One caption, joined across the frames it appeared in. */
export interface VideoTrack {
  text: string;
  startMs: number;
  endMs: number;
  box?: VideoTextBox | null;
}

export interface VideoRead {
  status: "ran" | "failed" | "skipped";
  model: string | null;
  ms: number;
  note: string;
}

export interface VideoInput {
  name: string;
  durationMs: number;
  width: number;
  height: number;
  sampledEveryMs: number;
  /** Every time a frame was taken, because samples aren't evenly spaced. */
  sampledMs?: number[];
  frames: VideoFrame[];
  read: VideoRead;
  /** Set when re-checking a saved video. */
  tracks?: VideoTrack[];
}

/** What is stored: the captions, and only the frames a person needs to see. */
export interface VideoReport extends Omit<VideoInput, "frames" | "tracks"> {
  frames: { ms: number; thumbnail?: string | null; logo?: LogoReadings | null }[];
  tracks: VideoTrack[];
}

/** One attempted use of AI during a check. Skipped and failed attempts are recorded too. */
export interface AiCall {
  pass: "judgement" | "image" | "video";
  status: "ran" | "failed" | "skipped";
  model: string | null;
  ms: number;
  sent: string; // what left the server, in plain words
  returned: string; // what came back, or why nothing did
}

export interface AiDisclosure {
  provider: string | null; // e.g. "Google Gemini · gemini-2.5-flash", null when AI was off
  passes: Pass[];
  note: string;
  calls: AiCall[];
}

export type ImageVerdict = "aligned" | "partly" | "off";

export interface ImageCheck {
  ruleId: string;
  label: string; // "Rule 6.2"
  title: string;
  pass: boolean;
  note: string;
  confidence: number;
}

/** What the AI image pass saw. The verdict is worked out in code, not by the model. */
export interface ImageReport {
  description: string;
  visibleText: string;
  verdict: ImageVerdict;
  checks: ImageCheck[];
}

export interface ReviewResult {
  findings: Finding[];
  claims: ClaimResult[];
  score: number;
  ai: AiDisclosure;
  imageReport: ImageReport | null;
  video?: VideoReport | null;
  dropped: number; // findings rejected by the verifier
  durationMs: number;
}

export type Role = "creator" | "reviewer" | "approver" | "admin";

export type SubmissionStatus = "draft" | "in_review" | "changes_requested" | "approved";

export interface Submission {
  id: string;
  kitId: string;
  createdBy: Role;
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
  imageReport?: ImageReport | null;
  video?: VideoReport | null;
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
  kitId: string;
  submissionId: string | null;
  role: Role;
  action: string;
  detail: string;
  at: string;
}
