// Generates the sample reel for a fictional brand, with mistakes planted on purpose.
// Usage: npx tsx scripts/make-demo-reel.ts. Output: public/demo/quickkart-winter-sale-reel.mp4

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import { QUICKKART_LOGO } from "../src/lib/db/demo-logo";

const WIDTH = 1080;
const HEIGHT = 1920;
const BAND_HEIGHT = 520;
const OUTPUT = "public/demo/quickkart-winter-sale-reel.mp4";
const TOTAL_SECONDS = 15;

interface Scene {
  seconds: number;
  background: string;
  headline: string[];
  smallPrint?: string;
}

// Planted: a superlative, a discount above the approved fact, a banned name, a disclaimer shown for one second.
// The last scene is correct, so the check has something it should leave alone.
const SCENES: Scene[] = [
  { seconds: 3, background: "#0b8f5a", headline: ["Fastest delivery", "in India"] },
  { seconds: 1, background: "#14213d", headline: ["Winter Sale", "90% off"], smallPrint: "T&amp;C apply" },
  { seconds: 3, background: "#14213d", headline: ["Winter Sale", "90% off"] },
  { seconds: 4, background: "#ff6b35", headline: ["Order now on", "Quick-Kart"] },
  { seconds: 4, background: "#0b8f5a", headline: ["Free delivery on", "orders above ₹199"] },
];

function sceneSvg(scene: Scene): Buffer {
  const lines = scene.headline.map((line, i) => `<text x="540" y="${1120 + i * 130}" font-family="Arial" font-size="104" font-weight="bold" text-anchor="middle" fill="#ffffff">${line}</text>`);
  const small = scene.smallPrint ? `<text x="540" y="1780" font-family="Arial" font-size="56" text-anchor="middle" fill="#ffffff">${scene.smallPrint}</text>` : "";
  return Buffer.from(`<svg width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="${scene.background}"/><rect width="${WIDTH}" height="${BAND_HEIGHT}" fill="#ffffff"/>${lines.join("")}${small}</svg>`);
}

async function main() {
  if (!ffmpeg) throw new Error("ffmpeg-static has no binary for this platform.");
  const folder = mkdtempSync(join(tmpdir(), "plumbline-reel-"));
  try {
    const logo = await sharp(Buffer.from(QUICKKART_LOGO.thumbnail.split(",")[1], "base64")).trim().png().toBuffer();
    const stretchedLogo = await sharp(logo).resize(480, 260, { fit: "fill" }).png().toBuffer();
    const paths = await Promise.all(
      SCENES.map(async (scene, index) => {
        const path = join(folder, `scene-${index}.png`).replace(/\\/g, "/");
        await sharp(sceneSvg(scene)).composite([{ input: stretchedLogo, left: 300, top: 130 }]).png().toFile(path);
        return path;
      })
    );
    const list = join(folder, "scenes.txt");
    const entries = SCENES.flatMap((scene, index) => [`file '${paths[index]}'`, `duration ${scene.seconds}`]);
    writeFileSync(list, [...entries, `file '${paths[paths.length - 1]}'`, ""].join("\n"));
    execFileSync(ffmpeg, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-t", String(TOTAL_SECONDS), "-r", "30", "-c:v", "libx264", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUTPUT]);
    console.log(`Saved ${OUTPUT}`);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
