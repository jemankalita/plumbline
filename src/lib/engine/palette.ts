// Measures which colours really cover an image. Flat areas are compared with the brand palette
// using CIEDE2000, which tracks what people see far better than plain RGB distance.

import { converter, differenceCiede2000, formatHex, type Lab65 } from "culori";

export interface ColorArea {
  hex: string;
  share: number; // 0–1 of the whole image
}

export interface Pixels {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

type Lab = [number, number, number];

const TILE = 16;
const FLAT_TILE_MAX_SPREAD = 9; // lightness spread above this is a photo or text edge, not a colour area
const NEUTRAL_CHROMA = 6; // black, white and grey belong to every brand
const CLUSTERS = 10;
const ROUNDS = 8;
const MIN_ALPHA = 200;
const ON_PALETTE = 6;
const OFF_PALETTE = 12;
const MIN_COVERAGE = 0.015;

const toLab = converter("lab65");
const delta = differenceCiede2000();
const lab = (hex: string): Lab => {
  const c = toLab(hex);
  return c ? [c.l, c.a, c.b] : [0, 0, 0];
};
const asColor = ([l, a, b]: Lab): Lab65 => ({ mode: "lab65", l, a, b });
export const deltaE = (a: string, b: string) => delta(asColor(lab(a)), asColor(lab(b)));

const rgbLab = (r: number, g: number, b: number): Lab => {
  const c = toLab({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return c ? [c.l, c.a, c.b] : [0, 0, 0];
};

const dist2 = (p: Lab, q: Lab) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
const chroma = (p: Lab) => Math.hypot(p[1], p[2]);

/** The mean colour of a tile, or null when it isn't a flat area of colour. */
function flatTile(px: Pixels, tx: number, ty: number): Lab | null {
  let [count, r, g, b, min, max] = [0, 0, 0, 0, 255, 0];
  for (let y = ty; y < Math.min(ty + TILE, px.height); y++) {
    for (let x = tx; x < Math.min(tx + TILE, px.width); x++) {
      const i = (y * px.width + x) * 4;
      if (px.data[i + 3] < MIN_ALPHA) continue;
      const luma = 0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2];
      [min, max] = [Math.min(min, luma), Math.max(max, luma)];
      r += px.data[i];
      g += px.data[i + 1];
      b += px.data[i + 2];
      count++;
    }
  }
  if (!count || max - min > FLAT_TILE_MAX_SPREAD * 2.55) return null;
  return rgbLab(r / count, g / count, b / count);
}

function seeds(points: Lab[], palette: Lab[]): Lab[] {
  const start = palette.filter((p) => chroma(p) >= NEUTRAL_CHROMA);
  const centres = start.length ? [...start] : [points[0]];
  while (centres.length < CLUSTERS) {
    const far = points.reduce((best, p) => {
      const d = Math.min(...centres.map((c) => dist2(p, c)));
      return d > best.d ? { p, d } : best;
    }, { p: points[0], d: -1 });
    if (far.d <= 0) break;
    centres.push(far.p);
  }
  return centres;
}

/** Finds the colours covering the image, largest first. Neutrals and photo areas don't count as brand colour. */
export function colorAreas(px: Pixels, paletteHexes: string[] = []): ColorArea[] {
  const flat: Lab[] = [];
  let total = 0;
  for (let y = 0; y < px.height; y += TILE) {
    for (let x = 0; x < px.width; x += TILE) {
      total++;
      const tile = flatTile(px, x, y);
      if (tile && chroma(tile) >= NEUTRAL_CHROMA) flat.push(tile);
    }
  }
  if (!flat.length) return [];
  let centres = seeds(flat, paletteHexes.map(lab));
  let members: Lab[][] = [];
  for (let round = 0; round < ROUNDS; round++) {
    members = centres.map(() => []);
    for (const p of flat) {
      const nearest = centres.reduce((best, c, i) => (dist2(p, c) < dist2(p, centres[best]) ? i : best), 0);
      members[nearest].push(p);
    }
    centres = centres.map((c, i) => {
      const m = members[i];
      if (!m.length) return c;
      return [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length, m.reduce((s, p) => s + p[2], 0) / m.length];
    });
  }
  return centres
    .map((c, i) => ({ hex: formatHex(asColor(c)) ?? "#000000", share: members[i].length / total }))
    .filter((a) => a.share > 0)
    .sort((a, b) => b.share - a.share);
}

export interface PaletteVerdict {
  off: (ColorArea & { nearest: number; delta: number })[];
  near: (ColorArea & { nearest: number; delta: number })[];
}

export function judgeAreas(areas: ColorArea[], paletteHexes: string[]): PaletteVerdict {
  const measured = areas
    .filter((a) => a.share >= MIN_COVERAGE)
    .map((a) => {
      const deltas = paletteHexes.map((p) => deltaE(a.hex, p));
      const nearest = deltas.indexOf(Math.min(...deltas));
      return { ...a, nearest, delta: deltas[nearest] };
    });
  return {
    off: measured.filter((a) => a.delta > OFF_PALETTE),
    near: measured.filter((a) => a.delta > ON_PALETTE && a.delta <= OFF_PALETTE),
  };
}
