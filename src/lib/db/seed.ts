// Demo data: a fictional quick-commerce brand, "QuickKart". Not a real company.

import type { BrandKit, ImageInput } from "../types";

export const DEMO_KIT: BrandKit = {
  id: "kit_quickkart",
  name: "QuickKart",
  voice:
    "Warm, quick and plain-spoken, like a helpful neighbour. Confident, never pushy. Indian English. Light Hinglish is fine on social, never in email or legal copy.",
  palette: [
    { name: "Kart Green", hex: "#0B8F5A" },
    { name: "Midnight", hex: "#10243E" },
    { name: "Saffron", hex: "#FF9F1C" },
    { name: "Cloud", hex: "#F4F7FB" },
    { name: "White", hex: "#FFFFFF" },
  ],
  rules: [
    {
      id: "R-1.1",
      section: "1.1",
      title: "Sound warm and confident, never pushy",
      text: "Write like a helpful neighbour. No hard selling, no shouting, no guilt.",
      category: "tone",
      severity: "warning",
      check: null,
      badExample: "BUY NOW before it's too late!!!",
      goodExample: "Your Diwali basket can be at your door in minutes.",
    },
    {
      id: "R-1.3",
      section: "1.3",
      title: "No slang forms of address",
      text: "Don't address customers as “guys”, “bro”, “dude” or “folks”.",
      category: "tone",
      severity: "suggestion",
      check: { kind: "pattern", pattern: "\\b(guys|bro|dude|folks)\\b", flags: "gi", fix: "everyone" },
    },
    {
      id: "R-1.4",
      section: "1.4",
      title: "One exclamation mark at most",
      text: "Use at most one exclamation mark at a time. More reads as shouting.",
      category: "tone",
      severity: "suggestion",
      check: { kind: "pattern", pattern: "!{2,}", flags: "g", fix: "!" },
    },
    {
      id: "R-2.1",
      section: "2.1",
      title: "Lead with the customer benefit",
      text: "Open with what the customer gets, not with what QuickKart is.",
      category: "messaging",
      severity: "suggestion",
      check: null,
      badExample: "QuickKart is India's leading app.",
      goodExample: "Groceries at your door in about 15 minutes.",
    },
    {
      id: "R-2.3",
      section: "2.3",
      title: "No fear or pressure tactics",
      text: "Avoid false urgency such as “last chance”, “hurry” or “don't miss out” unless an offer really ends that day.",
      category: "tone",
      severity: "warning",
      check: null,
    },
    {
      id: "R-2.5",
      section: "2.5",
      title: "Inclusive, respectful language",
      text: "Don't assume gender, age, income or family roles. Delivery staff are “delivery partners”.",
      category: "tone",
      severity: "warning",
      check: null,
    },
    {
      id: "R-3.2",
      section: "3.2",
      title: "Keep sentences short",
      text: "Keep sentences under 25 words so they read well on a phone.",
      category: "readability",
      severity: "suggestion",
      check: { kind: "maxSentenceWords", value: 25 },
    },
    {
      id: "R-3.4",
      section: "3.4",
      title: "No ALL-CAPS words in body copy",
      text: "Don't write words in capitals in body copy. Brand acronyms are fine.",
      category: "readability",
      severity: "suggestion",
      check: { kind: "pattern", pattern: "\\b[A-Z]{4,}\\b", flags: "g" },
    },
    {
      id: "R-4.2",
      section: "4.2",
      title: "Claims need approved evidence",
      text: "Superlatives (“fastest”, “best”, “#1”) and numbers must match an approved fact in the facts register.",
      category: "claim",
      severity: "blocker",
      check: { kind: "superlative" },
    },
    {
      id: "R-4.5",
      section: "4.5",
      title: "No guarantees we can't keep",
      text: "Never promise “risk-free”, “guaranteed” results or health benefits.",
      category: "legal",
      severity: "blocker",
      check: { kind: "pattern", pattern: "\\b(risk[- ]free|guaranteed|cures?|money[- ]back guarantee)\\b", flags: "gi" },
    },
    {
      id: "R-5.1",
      section: "5.1",
      title: "Every image needs alt text",
      text: "Every image must have alt text that says what it shows, including any text in it.",
      category: "accessibility",
      severity: "blocker",
      check: { kind: "altText" },
    },
    {
      id: "R-5.2",
      section: "5.2",
      title: "Text contrast at least 4.5 : 1",
      text: "Text on images must meet WCAG AA contrast (4.5 : 1).",
      category: "accessibility",
      severity: "blocker",
      check: { kind: "contrast", min: 4.5 },
    },
    {
      id: "R-6.1",
      section: "6.1",
      title: "Stay inside the brand palette",
      text: "Large colour areas must come from the brand palette.",
      category: "visual",
      severity: "warning",
      check: { kind: "palette", maxDistance: 22 },
    },
  ],
  terms: [
    { id: "T-1", preferred: "QuickKart", banned: ["Quick-Kart", "Quick Kart", "Quickkart", "QuikKart", "Quick Cart"], note: "One word, capital Q and K." },
    { id: "T-2", preferred: "QuickKart Plus", banned: ["QK Plus", "QuickKart+", "Quickkart Plus"], note: "Our membership. Always in full." },
    { id: "T-3", preferred: "delivery partner", banned: ["delivery boy", "delivery boys", "delivery guy"], note: "Our people are partners." },
    { id: "T-4", preferred: "delivery partners", banned: ["delivery executives"], note: null },
  ],
  facts: [
    {
      id: "F1",
      statement: "fast delivery across 40+ cities",
      keywords: ["delivery", "cities"],
      value: 40,
      source: "Ops coverage report, Q3 2026",
      owner: "Operations team",
      expiresOn: "2027-03-31",
    },
    {
      id: "F2",
      statement: "Over 3.1 lakh happy customers",
      keywords: ["customers"],
      value: 310000,
      source: "CRM export, Sep 2026",
      owner: "Growth team",
      expiresOn: "2026-12-31",
    },
    {
      id: "F3",
      statement: "Rated 4.6 on the Play Store",
      keywords: ["rated", "rating", "stars"],
      value: 4.6,
      source: "Play Store listing, Jul 2026",
      owner: "Product team",
      expiresOn: "2026-10-31",
    },
    {
      id: "F4",
      statement: "Up to 50% off in the Diwali Sale, 1–10 Nov 2026",
      keywords: ["off", "sale", "discount"],
      value: 50,
      source: "Campaign brief DS-26",
      owner: "Marketing team",
      expiresOn: "2026-11-10",
    },
    {
      id: "F5",
      statement: "Free delivery on orders above ₹199",
      keywords: ["free", "orders"],
      value: 199,
      source: "Pricing policy v7",
      owner: "Finance team",
      expiresOn: null,
    },
  ],
};

export interface SeedSubmission {
  title: string;
  channel: string;
  aiAssisted: boolean;
  keyMessage: string | null;
  status: "draft" | "in_review" | "changes_requested" | "approved";
  text: string;
  image?: ImageInput;
  daysAgo: number;
  /** Decisions to replay after review, by rule/term id → status (for Insights and the Gap Finder). */
  decisions?: { cite: string; status: "accepted" | "dismissed" | "overridden" | "cleared"; reason?: string }[];
}

export const DEMO_SUBMISSIONS: SeedSubmission[] = [
  {
    title: "Diwali offer · Instagram caption",
    channel: "Instagram",
    aiAssisted: true,
    keyMessage: "Diwali delivery offer",
    status: "in_review",
    daysAgo: 0,
    text: "This Diwali, get the fastest delivery in India with Quick-Kart! Over 2 lakh happy customers trust us. Shop now, guys!!!",
    image: { name: "diwali-banner.png", altText: "", colors: ["#FFD54A", "#FF9A1F"], thumbnail: null },
  },
  {
    title: "Welcome email · new users",
    channel: "Email",
    aiAssisted: false,
    keyMessage: "free delivery on first order",
    status: "approved",
    daysAgo: 6,
    decisions: [{ cite: "R-3.4", status: "dismissed", reason: "FREE is part of the offer name in the email header." }],
    text: "Welcome to QuickKart. Your first order comes with FREE delivery on orders above ₹199. Groceries, snacks and Diwali essentials reach you in minutes, across 40+ cities.",
  },
  {
    title: "App store description · update",
    channel: "App store",
    aiAssisted: true,
    keyMessage: null,
    status: "changes_requested",
    daysAgo: 4,
    decisions: [{ cite: "R-3.4", status: "dismissed", reason: "DIWALI is the campaign name, caps are approved." }],
    text: "QuickKart is rated 4.6 stars by our customers. Shop the DIWALI store for sweets, lights and gifts. Our delivery boys bring it to your door, risk-free.",
  },
  {
    title: "Partner hiring post · LinkedIn",
    channel: "LinkedIn",
    aiAssisted: false,
    keyMessage: "we are hiring delivery partners",
    status: "draft",
    daysAgo: 2,
    decisions: [{ cite: "R-3.4", status: "overridden", reason: "HIRING in caps is our recruitment format." }],
    text: "We are HIRING delivery partners in Pune and Guwahati. Flexible hours, weekly payouts and insurance from day one. Apply in the QuickKart Partner app.",
  },
];
