// Measures a logo once AI has found it. AI points at the logo; code decides whether it is stretched or recoloured.

import { deltaE, type Pixels } from "./palette";

export interface LogoReference {
  aspect: number; // width ÷ height of the mark
  fgHex: string; // main colour of the mark
}

export type LogoBox = [number, number, number, number]; // ymin, xmin, ymax, xmax, each 0–1000

export interface LogoReadings {
  aspectDiff: number;
  fgHex: string;
  colourDelta: number;
  /** Share of the space around the logo taken up by something else. */
  clearSpaceIntrusion: number;
}

export type LogoMeasure = ({ status: "measured"; aspect: number } & LogoReadings) | { status: "unmeasurable"; reason: string };

export type LogoRuleKind = "logoDistortion" | "logoColour" | "logoClearSpace";
export const isLogoRuleKind = (kind: string | undefined): kind is LogoRuleKind => kind === "logoDistortion" || kind === "logoColour" || kind === "logoClearSpace";

interface FoundLogo extends LogoReference {
  box: Region;
  background: [number, number, number];
}

const EXPAND = 0.15;
const MIN_SIDE_PX = 60;
const FOREGROUND_DIFF = 40; // RGB distance from the background that counts as logo
const MIN_FOREGROUND = 0.02;
const NOISE_SHARE = 0.01;
export const MAX_ASPECT_DIFF = 0.1;
export const MAX_COLOUR_DELTA = 12;
export const MAX_CLEAR_SPACE_INTRUSION = 0.03;
const CLEAR_SPACE_RATIO = 0.25; // the clear space around the logo, as a share of the logo's height

const hex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;

interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The background is whatever colour runs round the edge of the region. */
function edgeColour(px: Pixels, r: Region): [number, number, number] {
  const channels: number[][] = [[], [], []];
  const add = (x: number, y: number) => {
    const i = (y * px.width + x) * 4;
    channels.forEach((c, k) => c.push(px.data[i + k]));
  };
  for (let x = r.x0; x < r.x1; x++) [r.y0, r.y1 - 1].forEach((y) => add(x, y));
  for (let y = r.y0; y < r.y1; y++) [r.x0, r.x1 - 1].forEach((x) => add(x, y));
  return [median(channels[0]), median(channels[1]), median(channels[2])];
}

/** Finds the logo's pixels inside a region and returns its shape and main colour. */
function measureRegion(px: Pixels, r: Region): FoundLogo | null {
  const bg = edgeColour(px, r);
  const channels: number[][] = [[], [], []];
  const columns = new Map<number, number>();
  const rows = new Map<number, number>();
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) {
      const i = (y * px.width + x) * 4;
      if (px.data[i + 3] < 128) continue;
      if (Math.hypot(px.data[i] - bg[0], px.data[i + 1] - bg[1], px.data[i + 2] - bg[2]) < FOREGROUND_DIFF) continue;
      channels.forEach((c, k) => c.push(px.data[i + k]));
      columns.set(x, (columns.get(x) ?? 0) + 1);
      rows.set(y, (rows.get(y) ?? 0) + 1);
    }
  }
  const area = (r.x1 - r.x0) * (r.y1 - r.y0);
  if (channels[0].length < area * MIN_FOREGROUND) return null;
  const solid = (counts: Map<number, number>, span: number) => [...counts.entries()].filter(([, n]) => n >= span * NOISE_SHARE).map(([at]) => at);
  const xs = solid(columns, r.y1 - r.y0);
  const ys = solid(rows, r.x1 - r.x0);
  if (!xs.length || !ys.length) return null;
  const box = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs) + 1, y1: Math.max(...ys) + 1 };
  return { aspect: (box.x1 - box.x0) / (box.y1 - box.y0), fgHex: `#${hex(median(channels[0]))}${hex(median(channels[1]))}${hex(median(channels[2]))}`, box, background: bg };
}

/** Reads the shape and colour of the brand's own logo file. */
export function logoReference(px: Pixels): LogoReference | null {
  const found = measureRegion(px, { x0: 0, y0: 0, x1: px.width, y1: px.height });
  return found && { aspect: found.aspect, fgHex: found.fgHex };
}

/** How much of the band around the logo isn't background. */
function clearSpaceIntrusion(px: Pixels, { box, background }: FoundLogo): number {
  const margin = Math.round((box.y1 - box.y0) * CLEAR_SPACE_RATIO);
  let band = 0;
  let intruding = 0;
  for (let y = Math.max(0, box.y0 - margin); y < Math.min(px.height, box.y1 + margin); y++) {
    for (let x = Math.max(0, box.x0 - margin); x < Math.min(px.width, box.x1 + margin); x++) {
      if (x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1) continue;
      band++;
      const i = (y * px.width + x) * 4;
      if (Math.hypot(px.data[i] - background[0], px.data[i + 1] - background[1], px.data[i + 2] - background[2]) >= FOREGROUND_DIFF) intruding++;
    }
  }
  return band ? intruding / band : 0;
}

/** Code's verdict on one logo rule. A busy photo can look like clutter, so clear space goes to a person. */
export function judgeLogo(kind: LogoRuleKind, m: LogoReadings, originalHex: string): { pass: boolean; note: string; needsReview: boolean } {
  if (kind === "logoDistortion") return { pass: m.aspectDiff <= MAX_ASPECT_DIFF, note: `The logo's width-to-height differs from the original by ${Math.round(m.aspectDiff * 100)}%.`, needsReview: false };
  if (kind === "logoColour") return { pass: m.colourDelta <= MAX_COLOUR_DELTA, note: `The logo's main colour is ${m.fgHex}, ${m.colourDelta.toFixed(1)} away from the original (${originalHex}).`, needsReview: false };
  return { pass: m.clearSpaceIntrusion <= MAX_CLEAR_SPACE_INTRUSION, note: `Something else takes up ${Math.round(m.clearSpaceIntrusion * 100)}% of the clear space around the logo.`, needsReview: true };
}

export function measureLogo(px: Pixels, box: LogoBox, reference: LogoReference): LogoMeasure {
  const [ymin, xmin, ymax, xmax] = box;
  const x0 = (xmin / 1000) * px.width;
  const x1 = (xmax / 1000) * px.width;
  const y0 = (ymin / 1000) * px.height;
  const y1 = (ymax / 1000) * px.height;
  if (x1 - x0 < MIN_SIDE_PX || y1 - y0 < MIN_SIDE_PX / 3) return { status: "unmeasurable", reason: "The logo is too small in this image to measure." };
  const growX = (x1 - x0) * EXPAND;
  const growY = (y1 - y0) * EXPAND;
  const region = {
    x0: Math.max(0, Math.floor(x0 - growX)),
    y0: Math.max(0, Math.floor(y0 - growY)),
    x1: Math.min(px.width, Math.ceil(x1 + growX)),
    y1: Math.min(px.height, Math.ceil(y1 + growY)),
  };
  const found = measureRegion(px, region);
  if (!found) return { status: "unmeasurable", reason: "The logo doesn't stand out from its background enough to measure." };
  return {
    status: "measured",
    aspect: found.aspect,
    aspectDiff: Math.abs(found.aspect / reference.aspect - 1),
    fgHex: found.fgHex,
    colourDelta: deltaE(found.fgHex, reference.fgHex),
    clearSpaceIntrusion: clearSpaceIntrusion(px, found),
  };
}
