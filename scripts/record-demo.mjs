// Records a real run of the app checking the sample reel against the QuickKart Brand Kit.
// Usage: BASE_URL=http://localhost:3200 node scripts/record-demo.mjs [--rehearse]
// It needs installed Chrome, because the browser Playwright downloads can't decode H.264.
// Run it against a fresh local store, because the check saves a new draft.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import ffmpeg from "ffmpeg-static";
import { callout, caption, clearCallout, dress, titleCard } from "./demo-overlay.mjs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3200";
const REHEARSAL = process.argv.includes("--rehearse");
const REEL = path.resolve("public/demo/quickkart-winter-sale-reel.mp4");
const OUTPUT = "public/demo/reel-check.mp4";
const POSTER = "public/demo/reel-check-poster.jpg";
const VIEWPORT = { width: 1280, height: 720 };
const CHECK_TIMEOUT_MS = 90_000;
const PLAYBACK_SPEED = 1.25; // The landing page states this speed, so change both together.
const READ_MS = REHEARSAL ? 0 : 3200;
const POINT_MS = REHEARSAL ? 0 : 3800; // time to read a callout
const CARD_MS = REHEARSAL ? 200 : 3600;

const pause = (page, ms = READ_MS) => page.waitForTimeout(ms);

async function open(page, url) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "networkidle" });
  await dress(page);
}

async function moveTo(page, locator) {
  await clearCallout(page);
  await locator.evaluate((el, behavior) => el.scrollIntoView({ block: "center", behavior }), REHEARSAL ? "instant" : "smooth");
  await pause(page, REHEARSAL ? 50 : 700);
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no position on screen.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 14 });
  await pause(page, REHEARSAL ? 0 : 450);
}

/** Scrolls to the element, rings it and labels it. Skips quietly if the element is not on the page. */
async function point(page, locator, label, ms = POINT_MS) {
  if ((await locator.count()) === 0) {
    console.warn(`No element for callout: ${label}`);
    return;
  }
  await moveTo(page, locator);
  await callout(page, locator, label);
  await pause(page, ms);
}

async function click(page, locator) {
  await moveTo(page, locator);
  await locator.click();
}

async function showKit(page) {
  await caption(page, "One company, one Brand Kit: rules, brand names and approved facts", "1 / 4");
  await pause(page, REHEARSAL ? 0 : 1200);
  await page.getByRole("tab", { name: /Approved facts/ }).click();
  await pause(page, REHEARSAL ? 0 : 600);
  const fact = page.getByText(/Up to 50% off in the Winter Sale/).first();
  await fact.waitFor();
  await point(page, fact, "Approved fact: <b>50% off</b>");
}

async function addReel(page) {
  await open(page, "/new");
  await caption(page, "A creator adds a Winter Sale Reel for Instagram", "2 / 4");
  await click(page, page.getByRole("textbox", { name: "Title" }));
  await page.getByRole("textbox", { name: "Title" }).pressSequentially("Winter Sale reel", { delay: REHEARSAL ? 0 : 45 });
  const channel = page.getByRole("combobox", { name: "Channel" });
  await moveTo(page, channel);
  await channel.selectOption("Reels");
  await callout(page, channel, "Channel: <b>Reels</b>");
  await pause(page, REHEARSAL ? 0 : 1600);
  await page.locator('input[accept*="video/mp4"]').setInputFiles(REEL);
  await caption(page, "Frames are taken in the browser. The video file never leaves the device.", "2 / 4");
  const run = page.getByRole("button", { name: "Run the brand check" });
  await page.locator('button:has-text("Run the brand check"):enabled').waitFor({ timeout: CHECK_TIMEOUT_MS });
  await point(page, run, "Reel added. <b>Run the check</b>", REHEARSAL ? 0 : 2400);
  return run;
}

/** Sends the frames, and returns how long the check took. */
async function runCheck(page, run) {
  await caption(page, "AI reads the words and finds the logo. Plain code applies the kit.", "3 / 4");
  await moveTo(page, run);
  const started = Date.now();
  await run.click();
  await page.waitForURL(/\/s\/s_/, { timeout: CHECK_TIMEOUT_MS });
  await page.waitForLoadState("networkidle");
  const elapsed = Date.now() - started;
  await dress(page);
  return elapsed;
}

async function showFindings(page) {
  await page.getByText(/Seen at \d+:\d+/).first().waitFor({ timeout: CHECK_TIMEOUT_MS });
  await caption(page, "The verdict: a score, and every problem with the moment it appears", "4 / 4");
  await point(page, page.getByText(/^Off brand$|^Needs work$/).first(), "Brand score");
  await point(page, page.getByText(/the opening is sampled/).first(), "Frames read from the Reel");
  const cards = page.getByText(/Seen at \d+:\d+/);
  const total = await cards.count();
  if (total === 0) throw new Error("No findings appeared on the page.");
  for (let i = 0; i < total; i++) {
    const time = ((await cards.nth(i).textContent()) ?? "").match(/Seen at (\d+:\d+)/)?.[1] ?? "";
    await point(page, cards.nth(i), `Issue ${i + 1} of ${total} · seen at <b>${time}</b>`, REHEARSAL ? 0 : 3000);
  }
  await caption(page, "A person decides each one. Blockers stop approval.", "4 / 4");
  await point(page, page.getByRole("button", { name: "Send for approval" }).first(), "A person <b>decides</b>");
  await clearCallout(page);
  return total;
}

/** Returns the moment the first page was ready, so the blank start of the recording can be cut. */
async function journey(page) {
  await open(page, "/kit");
  const firstPageAt = Date.now();
  await titleCard(page, "Checking a Reel before it ships", "The real app, recorded in one take. QuickKart is a made-up brand, and the mistakes are planted.", CARD_MS);
  await showKit(page);
  const run = await addReel(page);
  const elapsed = await runCheck(page, run);
  const total = await showFindings(page);
  await titleCard(page, `${total} problems, each with its timestamp`, "Cited to a rule or approved fact. AI never approves: a person decides.", CARD_MS);
  const list = await page.getByText(/Seen at \d+:\d+|width-to-height/).allTextContents();
  console.log(`Check took ${(elapsed / 1000).toFixed(1)} s`);
  console.log(list.join("\n"));
  return firstPageAt;
}


function encode(webm, trimSeconds) {
  execFileSync(ffmpeg, ["-y", "-v", "error", "-ss", trimSeconds.toFixed(2), "-i", webm, "-an", "-vf", `setpts=PTS/${PLAYBACK_SPEED}`, "-c:v", "libx264", "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUTPUT]);
  execFileSync(ffmpeg, ["-y", "-v", "error", "-ss", "1.2", "-i", OUTPUT, "-frames:v", "1", "-q:v", "4", POSTER]);
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "plumbline-demo-"));
  const started = Date.now();
  const context = await browser.newContext({ viewport: VIEWPORT, ...(REHEARSAL ? {} : { recordVideo: { dir: folder, size: VIEWPORT } }) });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error("PAGE ERROR", error.message));
  let firstPageAt = started;
  try {
    firstPageAt = await journey(page);
  } finally {
    await context.close();
    await browser.close();
  }
  if (REHEARSAL) {
    console.log("Rehearsal passed.");
  } else {
    const webm = await page.video().path();
    encode(webm, (firstPageAt - started) / 1000);
    console.log(`Saved ${OUTPUT}, ${fs.statSync(OUTPUT).size} bytes`);
  }
  fs.rmSync(folder, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
