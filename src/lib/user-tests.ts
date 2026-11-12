/** What four real people found when they used Plumbline, and what changed because of it. */

export interface UserTester {
  readonly name: string;
  readonly role: string;
  readonly path: string;
  readonly worked: readonly string[];
}

export interface UserFix {
  readonly problem: string;
  readonly change: string;
  readonly foundBy: string;
}

export const USER_TESTERS: readonly UserTester[] = [
  {
    name: "Lakshya",
    role: "Marketing student",
    path: "First visit, from the landing page to approval",
    worked: ["Decisions saved, the score moved, and Approve stayed shut with a clear reason."],
  },
  {
    name: "Tushar",
    role: "Founder, UGC content company",
    path: "Admin sign-in, adding a brand term, checking a brief",
    worked: [
      "A wrong Admin code was refused with a plain message. We later removed the code so judges can open Admin freely.",
      "A newly added term flagged the next draft and reached the audit log.",
      "An email address was masked before the AI call.",
    ],
  },
  {
    name: "Amber",
    role: "International marketing student",
    path: "Non-English and multi-currency copy, then the accuracy page",
    worked: ["The accuracy page was clear, with no overflow."],
  },
  {
    name: "Naitik",
    role: "Works in clipping, YouTube Shorts",
    path: "Shorts checks at phone width",
    worked: [
      "A landscape clip was flagged for its shape and for “BEST clips”.",
      "A 3:20 clip was flagged as over the 180-second limit.",
      "“90 percent off” at 0:18 was flagged against the approved 50%.",
      "A 378 MB file was refused with a clear message.",
    ],
  },
];

export const USER_LESSONS: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: "The core loop holds",
    body: "Findings, decisions, the approval gate, Admin limits and video checks all did their job with people driving them.",
  },
  {
    title: "Real copy breaks number matching",
    body: "Matching a figure was not enough. Numbers are now compared by unit and currency before a claim counts as supported.",
  },
  {
    title: "Indian copy needs its own care",
    body: "Prices in rupees and dollars were being mixed up, and Hindi quotes were cut mid-letter. Both are fixed.",
  },
  {
    title: "The first look was too heavy",
    body: "Fifteen cards was a lot to meet at once. The same problem in a caption and on its banner is now one card, and optional suggestions wait behind one button, so the Diwali draft opens with 10.",
  },
];

export const USER_FIXES: readonly UserFix[] = [
  { problem: "“Delivery in 10 minutes” matched the fact “40+ cities” and offered “Change to 40”", change: "Numbers are compared by unit", foundBy: "Tushar" },
  { problem: "“$199” counted as supported by the fact “₹199”", change: "Prices are compared by currency", foundBy: "Amber" },
  { problem: "A Hindi quote was cut off mid-letter", change: "Quotes keep Hindi words whole", foundBy: "Amber" },
  { problem: "Brand Kit fields had no labels for screen readers", change: "Every field now has a linked label", foundBy: "Tushar" },
  { problem: "The queue said “1 blockers”", change: "Counts read correctly", foundBy: "Lakshya" },
  { problem: "The accuracy page said “1 false alarms”", change: "Counts read correctly", foundBy: "Amber" },
  { problem: "The Brand Kit header said “deterministic rules”", change: "Replaced with plain wording", foundBy: "Lakshya" },
  { problem: "Text and image checks reported the same issue twice", change: "Matching caption and image findings are one card that says so", foundBy: "Lakshya" },
  { problem: "15 cards was a lot for a first look", change: "Duplicates merged and suggestions folded: 10 cards on the Diwali draft", foundBy: "Lakshya" },
  { problem: "“This is right” was ambiguous on picture findings", change: "The button now reads “Agree, needs fixing”", foundBy: "Lakshya" },
];

export const USER_TEST_LIMIT =
  "This was a small first round, so we report what people found and not percentages. We did not measure task time or a usability score.";
