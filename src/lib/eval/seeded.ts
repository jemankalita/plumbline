// Builds test sentences where the truth is known because the error was put there on purpose.
// [[double brackets]] mark the planted error. Each one has a correct twin, so false alarms show up too.

import type { BrandKit } from "../types";
import type { GoldLabel } from "./match";

export interface SeededCase {
  citeId: string;
  text: string;
  gold: GoldLabel[];
  planted: boolean;
}

export const CASES_PER_RULE = 30;
export const AI_SENTENCES_PER_DOC = 10;

type Rng = () => number;

/** Small repeatable random numbers, so a run can be reproduced from its seed. */
export function rngFrom(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)];

const GROUPS = ["residents", "farmers", "carers", "students", "landlords", "small firms", "local councils", "volunteers"];
const THINGS = ["grant", "permit", "licence", "application", "payment", "survey", "report", "consultation"];
const OFFICES = ["council", "department", "tribunal", "regulator", "agency"];
const MONTHS = ["January", "March", "May", "June", "August", "October"];
const ORDINALS = ["1st", "2nd", "3rd", "14th", "21st", "30th"];
const SMALL = ["two", "three", "four", "five", "six", "seven", "eight", "nine"];
const SMALL_DIGIT: Record<string, string> = { two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9" };
const LONG_TAIL = "and it must include the full name of every person who is named on the original form together with the address where each of them lives now";

type Pair = [planted: string, correct: string];
type Maker = (rng: Rng) => Pair;

const CODE_RULES: Record<string, Maker> = {
  "gv-ampersand": (r) => { const [a, b] = [pick(r, GROUPS), pick(r, GROUPS)]; return [`Both ${a} [[&]] ${b} can apply.`, `Both ${a} and ${b} can apply.`]; },
  "gv-in-order-to": (r) => { const t = pick(r, THINGS); return [`You must register [[in order to]] get the ${t}.`, `You must register to get the ${t}.`]; },
  "gv-please": (r) => { const t = pick(r, THINGS); return [`[[Please]] send the ${t} to the office.`, `Send the ${t} to the office.`]; },
  "gv-ordinal-date": (r) => { const [o, m] = [pick(r, ORDINALS), pick(r, MONTHS)]; return [`The ${pick(r, THINGS)} closes on [[${o} ${m}]].`, `The ${pick(r, THINGS)} closes on ${o.replace(/\D/g, "")} ${m}.`]; },
  "gv-range-hyphen": (r) => { const a = 2 + Math.floor(r() * 7); const b = a + 2 + Math.floor(r() * 9); return [`It takes [[${a}-${b}]] weeks to process.`, `It takes ${a} to ${b} weeks to process.`]; },
  "gv-eg-etc-ie": (r) => { const t = pick(r, THINGS); return [`Bring proof of the ${t}, [[eg]] a letter.`, `Bring proof of the ${t}, for example a letter.`]; },
  "gv-contraction": (r) => { const t = pick(r, THINGS); return [`You [[shouldn't]] send the ${t} by post.`, `You should not send the ${t} by post.`]; },
  "gv-click": (r) => { const t = pick(r, THINGS); return [`[[Click]] the link to see the ${t}.`, `Select the link to see the ${t}.`]; },
  "gv-money-decimals": (r) => { const n = 10 + Math.floor(r() * 900); return [`The fee is [[£${n}.00]] a year.`, `The fee is £${n} a year.`]; },
  "gv-thousands-comma": (r) => { const n = 3000 + Math.floor(r() * 6000); return [`About [[${n * 3}]] people applied.`, `About ${(n * 3).toLocaleString("en-GB")} people applied.`]; },
  "gv-per-cent": (r) => { const n = 5 + Math.floor(r() * 90); return [`Around ${n} [[per cent]] of claims succeed.`, `Around ${n}% of claims succeed.`]; },
  "gv-small-numbers": (r) => { const n = pick(r, SMALL); return [`Reply within [[${n}]] days.`, `Reply within ${SMALL_DIGIT[n]} days.`]; },
  "gv-age-groups": (r) => { const n = pick(r, ["18", "25", "50", "65"]); return [`The scheme is for [[over-${n}s]] in the area.`, `The scheme is for people aged ${n} and over in the area.`]; },
  "gv-today-date": (r) => { const t = pick(r, THINGS); return [`The ${t} opens [[today]].`, `The ${t} opens today (14 ${pick(r, MONTHS)} 2026).`]; },
  "gv-sentence-length": (r) => { const t = pick(r, THINGS); return [`[[The ${t} has to be sent to the ${pick(r, OFFICES)} before the end of the month ${LONG_TAIL}.]]`, `The ${t} has to be sent to the ${pick(r, OFFICES)} before the end of the month.`]; },
};

const ABBREVIATIONS = [["DVLA", "Driver and Vehicle Licensing Agency"], ["HMRC", "HM Revenue and Customs"], ["DWP", "Department for Work and Pensions"], ["NHS", "National Health Service"], ["FCA", "Financial Conduct Authority"], ["ICO", "Information Commissioner's Office"]];
const US_WORDS = [["organize", "organise"], ["analyze", "analyse"], ["recognize", "recognise"], ["prioritize", "prioritise"], ["authorize", "authorise"], ["summarize", "summarise"]];
const IDIOMS = ["a stepping stone", "the jewel in the crown", "a rollercoaster ride", "a double-edged sword", "the tip of the iceberg", "a level playing field"];
const JARGON = [["pursuant to", "under"], ["in the event that", "if"], ["with a view to", "to"], ["notwithstanding", "despite"], ["prior to", "before"], ["in lieu of", "instead of"]];

const AI_RULES: Record<string, Maker> = {
  "gv-active-voice": (r) => { const [t, o] = [pick(r, THINGS), pick(r, OFFICES)]; return [`[[The ${t} was approved by the ${o}]].`, `The ${o} approved the ${t}.`]; },
  "gv-abbreviations": (r) => { const [short, long] = pick(r, ABBREVIATIONS); const t = pick(r, THINGS); return [`Contact the [[${short}]] about the ${t}.`, `Contact the ${long} about the ${t}.`]; },
  "gv-uk-english": (r) => { const [us, uk] = pick(r, US_WORDS); const t = pick(r, THINGS); return [`We will [[${us}]] the ${t}.`, `We will ${uk} the ${t}.`]; },
  "gv-metaphor": (r) => { const [t, g] = [pick(r, THINGS), pick(r, GROUPS)]; return [`This ${t} is [[${pick(r, IDIOMS)}]] for ${g}.`, `This ${t} helps ${g}.`]; },
  "gv-plain-english": (r) => { const [hard, easy] = pick(r, JARGON); const t = pick(r, THINGS); return [`You can apply [[${hard}]] the ${t}.`, `You can apply ${easy} the ${t}.`]; },
};

/** Removes the markers and records where each planted error ended up. */
export function parseMarked(marked: string, citeId: string, offset = 0): { text: string; gold: GoldLabel[] } {
  const gold: GoldLabel[] = [];
  let text = "";
  let rest = marked;
  for (;;) {
    const open = rest.indexOf("[[");
    if (open < 0) return { text: text + rest, gold };
    const close = rest.indexOf("]]", open);
    text += rest.slice(0, open);
    const quote = rest.slice(open + 2, close);
    gold.push({ quote, start: offset + text.length, end: offset + text.length + quote.length, citeId });
    text += quote;
    rest = rest.slice(close + 2);
  }
}

const caseFrom = (citeId: string, marked: string, planted: boolean): SeededCase => ({ citeId, planted, ...parseMarked(marked, citeId) });

function termCases(kit: BrandKit, rng: Rng): SeededCase[] {
  return kit.terms.flatMap((term) => {
    const banned = pick(rng, term.banned);
    return [caseFrom(term.id, `The word [[${banned}]] appears in this notice.`, true), caseFrom(term.id, `The word ${term.preferred} appears in this notice.`, false)];
  });
}

/** Sentences for the checks done by plain code. These cost no AI quota. */
export function codeCases(kit: BrandKit, seed: number): SeededCase[] {
  const rng = rngFrom(seed);
  const rules = Object.entries(CODE_RULES).flatMap(([citeId, make]) =>
    Array.from({ length: CASES_PER_RULE }, () => {
      const [planted, correct] = make(rng);
      return [caseFrom(citeId, planted, true), caseFrom(citeId, correct, false)];
    }).flat()
  );
  return [...rules, ...termCases(kit, rng)];
}

/** Each document holds one rule's planted and correct sentences. Only that rule is scored on it. */
export function aiDocuments(seed: number): SeededCase[] {
  const rng = rngFrom(seed);
  const docsPerRule = (CASES_PER_RULE * 2) / AI_SENTENCES_PER_DOC;
  return Object.entries(AI_RULES).flatMap(([citeId, make]) =>
    Array.from({ length: docsPerRule }, () => {
      const pairs = Array.from({ length: AI_SENTENCES_PER_DOC / 2 }, () => make(rng));
      const lines = pairs.flat().map((line) => ({ line, order: rng() })).sort((a, b) => a.order - b.order);
      const joined = lines.map((l) => l.line).join(" ");
      return { citeId, planted: true, ...parseMarked(joined, citeId) };
    })
  );
}
