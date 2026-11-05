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
  lacma: { src: "/media/plumb-bob-lacma.webp", w: 1072, h: 2100, alt: "A bronze plumb bob from Egypt, green with age, hanging from its loop" },
  string: { src: "/media/plumb-bob-string.webp", w: 1400, h: 2256, alt: "A white plumb bob on a string hanging against a brick and mortar wall" },
  proof: { src: "/media/printing-proof-1889.webp", w: 1400, h: 1777, alt: "An 1889 printer's proof sheet of dancer cards, with registration marks and a colour bar" },
  printing: { src: "/media/invention-of-printing.webp", w: 1400, h: 1026, alt: "A sixteenth-century drawing of a busy printing workshop, compositors and presses at work" },
  hatshepsut: { src: "/media/plumb-bob-hatshepsut.webp", w: 500, h: 625, alt: "A red stone plumb bob carved with the name of Hatshepsut" },
  roman: { src: "/media/plumb-bob-roman.webp", w: 1400, h: 1050, alt: "A Roman iron plumb bob hanging on a string in a museum case of tools" },
  fitzwilliam: { src: "/media/plumb-bob-fitzwilliam.webp", w: 1200, h: 1600, alt: "A carved basalt ceremonial plumb bob hanging against a plum-coloured wall" },
  pas: { src: "/media/plumb-bob-pas.webp", w: 1400, h: 981, alt: "Two views of a small excavated lead plumb bob beside a centimetre scale" },
} as const;

export const CREDITS: { title: string; by?: string; licence: string; licenceUrl: string; page: string }[] = [
  { title: "Plumb Bob (LACMA M.80.198.176)", licence: "public domain", licenceUrl: "https://creativecommons.org/publicdomain/mark/1.0/", page: "https://commons.wikimedia.org/wiki/File:Plumb_Bob_LACMA_M.80.198.176.jpg" },
  { title: "Plumb bob with string", by: "Salil Kumar Mukherjee", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", page: "https://commons.wikimedia.org/w/index.php?curid=143208943" },
  { title: "The Invention of Book Printing", by: "Jan van der Straet (Stradanus)", licence: "CC0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/", page: "https://collection.cooperhewitt.org/view/objects/asitem/id/9696" },
  { title: "Printing proof of cards, National Dances, Kinney Bros., 1889", licence: "CC0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/", page: "https://www.metmuseum.org/art/collection/search/717859" },
  { title: "Plumb Bob with the Name of Hatshepsut", licence: "CC0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/", page: "https://www.metmuseum.org/art/collection/search/548705" },
  { title: "Roman plumb bob", by: "Gaius Cornelius", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", page: "https://commons.wikimedia.org/w/index.php?curid=68356188" },
  { title: "Carved ceremonial plumb-bob, Fitzwilliam Museum", by: "SpeakingArch", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0", page: "https://commons.wikimedia.org/wiki/File:Carved_ceremonial_plumb-bob_332-30_CE,_Basalt,_Fitzwilliam_Museum,_Cambridge.jpg" },
  { title: "Plumb bob", by: "The Portable Antiquities Scheme, Ben Jones", licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/", page: "https://commons.wikimedia.org/w/index.php?curid=74891114" },
];
