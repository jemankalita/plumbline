import type { Severity } from "@/lib/types";

/** One finding from a real engine run, shaped for the departure-board showcase. */
export interface BoardRow {
  id: string;
  draft: string;
  quote: string;
  cite: string; // "Rule 4.2", "Fact F2", "Term · QuickKart"
  title: string; // what the cited record says, in a few words
  pass: string;
  severity: Severity;
  message: string;
  fix: string | null;
}

/** A finding the replay can draw inside the draft text. `fix` is null when it can't be one click. */
export interface ReplayFinding extends BoardRow {
  start: number;
  end: number;
}

/** The real check the hero replays: one demo draft and what the engine found in it. */
export interface ReplayRun {
  title: string;
  channel: string;
  text: string;
  findings: ReplayFinding[];
}

/** A kind of Brand Kit record and the names in it, for the typographic list. */
export interface KitColumn {
  kind: string;
  names: string[];
}

export interface LandingData {
  aiOn: boolean;
  replay: ReplayRun;
  board: BoardRow[];
  /** True totals for the run; the board may show only the first rows. */
  checked: { drafts: number; findings: number };
  columns: KitColumn[];
  boardMs: number;
}

export const EASE = [0.22, 1, 0.36, 1] as const;
