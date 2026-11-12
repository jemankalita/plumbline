// Draws the fictional QuickKart wordmark and records its shape. Usage: npx tsx eval/scripts/make-demo-logo.ts
import { writeFileSync } from "node:fs";
import sharp from "sharp";
import { logoReference } from "../../src/lib/engine/logo";

export const WORDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120"><rect width="480" height="120" fill="#ffffff"/><text x="240" y="84" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="72" text-anchor="middle" fill="#0B8F5A">QuickKart</text></svg>`;

async function main() {
  const png = await sharp(Buffer.from(WORDMARK_SVG)).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const reference = logoReference({ data, width: info.width, height: info.height });
  if (!reference) throw new Error("Could not measure the wordmark.");
  const logo = { name: "QuickKart wordmark", thumbnail: `data:image/png;base64,${png.toString("base64")}`, ...reference };
  writeFileSync("src/lib/db/demo-logo.ts", `// Made by eval/scripts/make-demo-logo.ts. A fictional brand's wordmark.\nimport type { BrandLogo } from "../types";\n\nexport const QUICKKART_LOGO: BrandLogo = ${JSON.stringify(logo, null, 2)};\n`);
  console.log(reference);
}

if (process.argv[1]?.endsWith("make-demo-logo.ts")) main();
