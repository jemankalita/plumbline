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

/** A kind of Brand Kit record and the names in it, for the typographic list. */
export interface KitColumn {
  kind: string;
  names: string[];
}

export interface LandingData {
  aiOn: boolean;
  board: BoardRow[];
  columns: KitColumn[];
  boardMs: number;
}

export const EASE = [0.22, 1, 0.36, 1] as const;

export const MEDIA = {
  string: { src: "/media/plumb-bob-string.webp", w: 1400, h: 2256, alt: "A white plumb bob on a string hanging against a brick and mortar wall" },
} as const;

export const CREDITS: { title: string; by?: string; licence: string; licenceUrl: string; page: string }[] = [
  { title: "Plumb bob with string", by: "Salil Kumar Mukherjee", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", page: "https://commons.wikimedia.org/w/index.php?curid=143208943" },
];
