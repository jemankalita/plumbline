// Browser side of image handling. Colours are read here; only a small copy leaves the device.

import { dominantColors } from "./engine/color";
import { colorAreas } from "./engine/palette";
import type { ImageInput } from "./types";

const MAX_BYTES = 8 * 1024 * 1024;
const COLOR_SAMPLE_PX = 120;
const AREA_SAMPLE_PX = 320;
const MAX_AREAS = 12;
const MAX_DATA_URL = 380_000; // stays under the API limit on thumbnails
const ATTEMPTS = [
  { px: 768, quality: 0.8 },
  { px: 640, quality: 0.7 },
  { px: 480, quality: 0.6 },
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't read that image."));
    el.src = url;
  });
}

function draw(img: HTMLImageElement, max: number) {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * k));
  canvas.height = Math.max(1, Math.round(img.height * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't read images.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

/** Turn a file or fetched picture into what the Review Engine needs. Throws a readable Error. */
export async function prepareImage(file: Blob, name: string, altText = ""): Promise<ImageInput> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Images must be PNG, JPEG or WebP.");
  if (file.size > MAX_BYTES) throw new Error("Images must be 8 MB or smaller.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const sample = draw(img, COLOR_SAMPLE_PX);
    const colors = dominantColors(sample.ctx.getImageData(0, 0, sample.canvas.width, sample.canvas.height).data, 4);
    const areaSample = draw(img, AREA_SAMPLE_PX);
    const areas = colorAreas({ data: areaSample.ctx.getImageData(0, 0, areaSample.canvas.width, areaSample.canvas.height).data, width: areaSample.canvas.width, height: areaSample.canvas.height }).slice(0, MAX_AREAS);
    const thumbnail =
      ATTEMPTS.map(({ px, quality }) => draw(img, px).canvas.toDataURL("image/jpeg", quality)).find((d) => d.length < MAX_DATA_URL) ?? null;
    return { name, altText, colors, colorAreas: areas, thumbnail };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Load one of the demo pictures from /public and prepare it like an upload. */
export async function prepareDemoImage(src: string, name: string, altText = ""): Promise<ImageInput> {
  const res = await fetch(src).catch(() => null);
  if (!res?.ok) throw new Error("Couldn't load that demo image. Please try again.");
  return prepareImage(await res.blob(), name, altText);
}
