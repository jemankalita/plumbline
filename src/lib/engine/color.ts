// Colour maths: WCAG contrast, perceptual distance (CIE76 in Lab), palette helpers.

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB | null {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB;
}

export function rgbToHex([r, g, b]: RGB): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrast(a: RGB, b: RGB): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

function toLab([r, g, b]: RGB): [number, number, number] {
  const [R, G, B] = [r, g, b].map(channel);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Perceptual distance. Under ~10 reads as "the same colour" to most people. */
export function deltaE(a: RGB, b: RGB): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export function nearest(color: RGB, palette: RGB[]): { index: number; distance: number } {
  let best = { index: -1, distance: Infinity };
  palette.forEach((p, index) => {
    const distance = deltaE(color, p);
    if (distance < best.distance) best = { index, distance };
  });
  return best;
}

/**
 * Quantise raw RGBA pixels into dominant colours (most frequent first).
 * Runs in the browser on a downscaled canvas, so the full image never leaves the device.
 */
export function dominantColors(pixels: Uint8ClampedArray, max = 5): string[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const key = `${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`;
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += pixels[i];
    bucket.g += pixels[i + 1];
    bucket.b += pixels[i + 2];
    buckets.set(key, bucket);
  }
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n);
  const total = sorted.reduce((s, b) => s + b.n, 0) || 1;
  const picked: RGB[] = [];
  for (const b of sorted) {
    if (b.n / total < 0.02) break;
    const rgb: RGB = [b.r / b.n, b.g / b.n, b.b / b.n];
    if (picked.every((p) => deltaE(p, rgb) > 12)) picked.push(rgb);
    if (picked.length >= max) break;
  }
  return picked.map(rgbToHex);
}
