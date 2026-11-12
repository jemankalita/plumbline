// A second fictional brand, "Harbour & Pine". It proves one organisation's work never touches another's.

import type { BrandKit } from "../types";
import type { SeedSubmission } from "./seed";

export const HARBOUR_KIT: BrandKit = {
  id: "kit_harbour",
  name: "Harbour & Pine",
  voice: "Calm, considered and plain. We talk about materials and how a thing is made. We never rush the reader.",
  palette: [
    { name: "Deep Harbour", hex: "#1F3A44" },
    { name: "Pine", hex: "#3F6B52" },
    { name: "Sand", hex: "#E8DFCF" },
    { name: "Clay", hex: "#B5694A" },
  ],
  rules: [
    {
      id: "hp-R-1.1",
      section: "1.1",
      title: "Calm voice, no hype",
      text: "Describe the product plainly. No hype, no urgency and no exclamation marks.",
      category: "tone",
      severity: "warning",
      check: { kind: "pattern", pattern: "!", flags: "g", fix: "." },
    },
    {
      id: "hp-R-2.1",
      section: "2.1",
      title: "Name the material",
      text: "Say what the product is made of, using the material's proper name.",
      category: "messaging",
      severity: "suggestion",
      check: null,
    },
    {
      id: "hp-R-3.1",
      section: "3.1",
      title: "Keep sentences short",
      text: "Keep sentences under 22 words.",
      category: "readability",
      severity: "suggestion",
      check: { kind: "maxSentenceWords", value: 22 },
    },
    {
      id: "hp-R-4.1",
      section: "4.1",
      title: "Sustainability claims need evidence",
      text: "Superlatives and environmental claims must match an approved fact.",
      category: "claim",
      severity: "blocker",
      check: { kind: "superlative" },
    },
    {
      id: "hp-R-5.1",
      section: "5.1",
      title: "Every image needs alt text",
      text: "Every image must have alt text that says what it shows.",
      category: "accessibility",
      severity: "blocker",
      check: { kind: "altText" },
    },
  ],
  terms: [
    { id: "hp-T-1", preferred: "Harbour & Pine", banned: ["Harbor & Pine", "Harbour and Pine", "H&P"], note: "British spelling, always the ampersand." },
    { id: "hp-T-2", preferred: "solid oak", banned: ["real wood", "genuine wood"], note: "Name the timber." },
  ],
  facts: [
    {
      id: "hp-F1",
      statement: "Made from FSC-certified oak",
      keywords: ["fsc", "certified", "oak"],
      value: null,
      source: "Supplier certificate, 2026",
      owner: "Sourcing team",
      expiresOn: "2027-06-30",
    },
    {
      id: "hp-F2",
      statement: "Ten-year frame guarantee",
      keywords: ["guarantee", "ten-year", "years"],
      value: 10,
      source: "Warranty policy v3",
      owner: "Customer care",
      expiresOn: null,
    },
  ],
};

export const HARBOUR_SUBMISSIONS: SeedSubmission[] = [
  {
    title: "Oak dining table · product page",
    channel: "Website",
    aiAssisted: false,
    keyMessage: "solid oak table made to last",
    status: "draft",
    daysAgo: 1,
    text: "Our Fenwick table is made from real wood and comes with a ten-year frame guarantee. Order yours today!",
  },
  {
    title: "Autumn newsletter · intro",
    channel: "Email",
    aiAssisted: true,
    keyMessage: null,
    status: "in_review",
    daysAgo: 3,
    text: "Harbor & Pine is the greenest furniture maker in the country. This autumn we are adding three new pieces in FSC-certified oak.",
  },
];
