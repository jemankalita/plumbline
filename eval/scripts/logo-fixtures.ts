// Measures the logo and palette checks on pictures where the right answer is known because we made the fault.
// Usage: npx tsx eval/scripts/logo-fixtures.ts. The logo's position is given, so AI's locating is not part of this score.

import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { QUICKKART_LOGO } from "../../src/lib/db/demo-logo";
import { MAX_ASPECT_DIFF, MAX_CLEAR_SPACE_INTRUSION, MAX_COLOUR_DELTA, measureLogo, type LogoBox, type LogoReference } from "../../src/lib/engine/logo";
import { colorAreas, judgeAreas } from "../../src/lib/engine/palette";

const SIDE = 768;
const BACKGROUNDS = ["#ffffff", "#fff8ec", "#f1f3f5", "#fbeef2", "#eef5ff"];
const PALETTE = ["#0b8f5a", "#ff6b35", "#14213d"];
const WIDTHS = [240, 280, 320, 360, 400, 440, 480, 520, 560, 600];
const STRETCH = [0.6, 0.68, 0.75, 0.8, 0.85, 1.2, 1.3, 1.45, 1.6, 1.8];
const HUES = [40, 70, 100, 130, 160, 190, 220, 250, 280, 320];
const logoInput = Buffer.from(QUICKKART_LOGO.thumbnail.split(",")[1], "base64");
const reference: LogoReference = { aspect: QUICKKART_LOGO.aspect, fgHex: QUICKKART_LOGO.fgHex };

interface Fixture {
  kind: "clean" | "stretched" | "recoloured";
  logo: Buffer;
  width: number;
  height: number;
  index: number;
}

async function trimmedLogo() {
  const buffer = await sharp(logoInput).trim().png().toBuffer();
  const { width, height } = await sharp(buffer).metadata();
  return { buffer, width: width as number, height: height as number };
}

async function resized(buffer: Buffer, width: number, height: number) {
  return sharp(buffer).resize(width, height, { fit: "fill" }).png().toBuffer();
}

async function fixtures(): Promise<Fixture[]> {
  const base = await trimmedLogo();
  const heightFor = (width: number) => Math.round((width * base.height) / base.width);
  const clean = WIDTHS.map(async (width, index) => ({ kind: "clean" as const, logo: await resized(base.buffer, width, heightFor(width)), width, height: heightFor(width), index }));
  const stretched = STRETCH.map(async (factor, index) => {
    const width = WIDTHS[index];
    const height = Math.round(heightFor(width) * factor);
    return { kind: "stretched" as const, logo: await resized(base.buffer, width, height), width, height, index };
  });
  const recoloured = HUES.map(async (hue, index) => {
    const width = WIDTHS[index];
    const logo = await sharp(await resized(base.buffer, width, heightFor(width))).modulate({ hue }).png().toBuffer();
    return { kind: "recoloured" as const, logo, width, height: heightFor(width), index };
  });
  return Promise.all([...clean, ...stretched, ...recoloured]);
}

async function rawPixels(image: ReturnType<typeof sharp>) {
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

async function scoreLogo(f: Fixture) {
  const left = 40 + (f.index * 13) % 100;
  const top = 80 + (f.index * 47) % 500;
  const image = sharp({ create: { width: SIDE, height: SIDE, channels: 4, background: BACKGROUNDS[f.index % BACKGROUNDS.length] } }).composite([{ input: f.logo, left, top }]).png();
  const px = await rawPixels(sharp(await image.toBuffer()));
  const toUnits = (value: number) => (value / SIDE) * 1000;
  const box: LogoBox = [toUnits(top), toUnits(left), toUnits(top + f.height), toUnits(left + f.width)];
  const result = measureLogo(px, box, reference);
  if (result.status !== "measured") return { kind: f.kind, status: "unmeasurable" as const, flagged: false };
  return { kind: f.kind, status: "measured" as const, flagged: result.aspectDiff > MAX_ASPECT_DIFF || result.colourDelta > MAX_COLOUR_DELTA };
}

/** A logo alone, or with a bar placed inside its clear space, so the right answer is known. */
async function scoreClearSpace(index: number, intrude: boolean) {
  const base = await trimmedLogo();
  const width = WIDTHS[index];
  const height = Math.round((width * base.height) / base.width);
  const left = 40 + (index * 13) % 100;
  const top = 80 + (index * 47) % 500;
  const bar = { width: Math.round(width * 0.6), height: Math.max(2, Math.ceil(height * 0.06)), channels: 4 as const, background: "#14213d" };
  const layers = [{ input: await resized(base.buffer, width, height), left, top }, ...(intrude ? [{ input: { create: bar }, left: left + Math.round(width * 0.2), top: top + height + Math.ceil(height * 0.18) }] : [])];
  const image = sharp({ create: { width: SIDE, height: SIDE, channels: 4, background: BACKGROUNDS[index % BACKGROUNDS.length] } }).composite(layers).png();
  const px = await rawPixels(sharp(await image.toBuffer()));
  const toUnits = (value: number) => (value / SIDE) * 1000;
  const result = measureLogo(px, [toUnits(top), toUnits(left), toUnits(top + height), toUnits(left + width)], reference);
  return result.status === "measured" && result.clearSpaceIntrusion > MAX_CLEAR_SPACE_INTRUSION;
}

const shifted = (hex: string, by: number) => `#${[1, 3, 5].map((i) => Math.min(255, Math.max(0, parseInt(hex.slice(i, i + 2), 16) + by)).toString(16).padStart(2, "0")).join("")}`;
const OFF_COLOURS = ["#7b2cbf", "#e63946", "#00b4d8", "#ffd60a", "#8338ec", "#d00000", "#3a86ff", "#f72585", "#ffbe0b", "#6a4c93"];

async function scorePalette(hex: string, expectOff: boolean) {
  const image = sharp({ create: { width: SIDE, height: SIDE, channels: 4, background: "#ffffff" } }).composite([{ input: { create: { width: SIDE, height: 300, channels: 4, background: hex } }, left: 0, top: 200 }]).png();
  const px = await rawPixels(sharp(await image.toBuffer()));
  const verdict = judgeAreas(colorAreas(px, PALETTE), PALETTE);
  return { correct: verdict.off.length > 0 === expectOff, expectOff };
}

async function main() {
  const logos: Awaited<ReturnType<typeof scoreLogo>>[] = [];
  for (const f of await fixtures()) logos.push(await scoreLogo(f));
  const on = [0, 3, -3, 2].flatMap((by) => PALETTE.map((p) => shifted(p, by))).slice(0, 10);
  const palette = [];
  for (const hex of on) palette.push(await scorePalette(hex, false));
  for (const hex of OFF_COLOURS) palette.push(await scorePalette(hex, true));
  const clearFlags: boolean[] = [];
  const intrudedFlags: boolean[] = [];
  for (const index of WIDTHS.keys()) {
    clearFlags.push(await scoreClearSpace(index, false));
    intrudedFlags.push(await scoreClearSpace(index, true));
  }
  const count = (kind: string, test: (r: (typeof logos)[number]) => boolean) => logos.filter((r) => r.kind === kind && test(r)).length;
  const report = {
    logo: {
      clean: { total: 10, passed: count("clean", (r) => r.status === "measured" && !r.flagged), unmeasurable: count("clean", (r) => r.status === "unmeasurable") },
      stretched: { total: 10, caught: count("stretched", (r) => r.flagged), unmeasurable: count("stretched", (r) => r.status === "unmeasurable") },
      recoloured: { total: 10, caught: count("recoloured", (r) => r.flagged), unmeasurable: count("recoloured", (r) => r.status === "unmeasurable") },
    },
    clearSpace: {
      clean: { total: clearFlags.length, passed: clearFlags.filter((flagged) => !flagged).length },
      intruded: { total: intrudedFlags.length, caught: intrudedFlags.filter(Boolean).length },
    },
    palette: {
      onPalette: { total: palette.filter((r) => !r.expectOff).length, correct: palette.filter((r) => !r.expectOff && r.correct).length },
      offPalette: { total: palette.filter((r) => r.expectOff).length, correct: palette.filter((r) => r.expectOff && r.correct).length },
    },
    limits: ["Pictures are generated, not real campaign art.", "The logo's position is given to the check. How well AI finds a logo in a real picture is not measured.", "Clear space is tested on plain backgrounds. A busy photo can look like clutter, so those findings go to a person."],
  };
  mkdirSync("public/eval", { recursive: true });
  writeFileSync("public/eval/media-1.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.logo), JSON.stringify(report.palette));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
