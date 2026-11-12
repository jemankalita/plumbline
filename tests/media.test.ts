import { describe, expect, it } from "vitest";
import { altProblem } from "../src/lib/engine/alt";
import { judgeLogo, measureLogo } from "../src/lib/engine/logo";
import { colorAreas, judgeAreas, type Pixels } from "../src/lib/engine/palette";
import { checkVideo, frameChange, inputFromReport, pickChangedTimes, sampleTimes, scanTimes } from "../src/lib/engine/video";
import { DEMO_KIT } from "../src/lib/db/seed";
import type { BrandKit, VideoInput } from "../src/lib/types";

/** A white square with one solid rectangle on it. */
function canvas(side: number, rect: { x0: number; y0: number; x1: number; y1: number }, rgb: [number, number, number]): Pixels {
  const data = new Uint8Array(side * side * 4).fill(255);
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) data.set([...rgb, 255], (y * side + x) * 4);
  }
  return { data, width: side, height: side };
}

const GREEN: [number, number, number] = [11, 143, 90];
const reference = { aspect: 4, fgHex: "#0b8f5a" };

describe("time on screen", () => {
  const kitWith = (seconds: number): BrandKit => ({ ...DEMO_KIT, rules: [{ ...DEMO_KIT.rules[0], id: "R-T", section: "7.2", category: "legal", severity: "warning", check: { kind: "minOnScreen", pattern: "t&c", seconds } }] });
  const framesAt = (ms: number[], shownAt: number[]) => ms.map((at) => ({ ms: at, texts: shownAt.includes(at) ? [{ text: "T&C apply" }] : [] }));
  const video = (ms: number[], shownAt: number[]): VideoInput => ({ name: "a.mp4", durationMs: 8000, width: 1080, height: 1920, sampledEveryMs: 2000, read: { status: "ran", model: "m", ms: 1, note: "" }, frames: framesAt(ms, shownAt) });
  const onScreen = (ms: number[], shownAt: number[], seconds = 3) => checkVideo(video(ms, shownAt), kitWith(seconds)).findings.filter((f) => f.cites.id === "R-T");

  it("passes a disclaimer that was seen for longer than the rule needs", () => {
    expect(onScreen([0, 2000, 4000, 6000, 8000], [0, 2000, 4000, 6000])).toHaveLength(0);
  });

  it("flags a disclaimer that cannot have been on screen long enough", () => {
    const [finding] = onScreen([0, 500, 1000, 1500], [500]);
    expect(finding.needsReview).toBe(false);
    expect(finding.message).toContain("at most 1 s");
  });

  it("sends a person the cases sampling can't settle", () => {
    const [finding] = onScreen([0, 2000, 4000, 6000, 8000], [4000, 6000]);
    expect(finding.needsReview).toBe(true);
    expect(finding.message).toContain("between 2 and 6 s");
  });
});

describe("change-detected frames", () => {
  const quiet = (seconds: number) => scanTimes(seconds).map((t) => ({ t, change: 0 }));

  it("stays with even sampling when nothing changes", () => {
    expect(pickChangedTimes(100, quiet(100))).toEqual(sampleTimes(100));
  });

  it("spends a slot on a sudden change", () => {
    const scans = quiet(100).map((s) => (Math.abs(s.t - 50) < 0.6 ? { ...s, change: 0.4 } : s));
    const spike = scans.find((s) => s.change > 0)?.t as number;
    expect(pickChangedTimes(100, scans)).toContain(spike);
  });

  it("keeps the opening and the last frame and stays within the frame limit", () => {
    const scans = quiet(200).map((s, i) => ({ ...s, change: (i % 7) / 10 }));
    const picked = pickChangedTimes(200, scans);
    expect(picked.length).toBeLessThanOrEqual(20);
    expect(picked).toEqual(expect.arrayContaining([0, 1, 3, 199.95]));
  });

  it("measures how different two pictures are", () => {
    expect(frameChange([0, 0, 0, 255], [255, 255, 255, 255])).toBe(1);
    expect(frameChange([9, 9, 9, 255], [9, 9, 9, 255])).toBe(0);
  });
});

describe("logo measuring", () => {
  it("passes a logo at the right shape and colour", () => {
    const px = canvas(400, { x0: 100, y0: 100, x1: 300, y1: 150 }, GREEN);
    const result = measureLogo(px, [250, 250, 375, 750], reference);
    expect(result.status === "measured" && result.aspectDiff).toBeLessThan(0.1);
  });

  it("sees a stretched logo", () => {
    const px = canvas(400, { x0: 100, y0: 100, x1: 300, y1: 200 }, GREEN);
    const result = measureLogo(px, [250, 250, 500, 750], reference);
    expect(result.status === "measured" && result.aspectDiff).toBeGreaterThan(0.1);
  });

  it("says so when a logo is too small to measure", () => {
    const px = canvas(400, { x0: 100, y0: 100, x1: 120, y1: 105 }, GREEN);
    expect(measureLogo(px, [250, 250, 262, 300], reference).status).toBe("unmeasurable");
  });
});

describe("logo clear space", () => {
  const logo = { x0: 200, y0: 300, x1: 600, y1: 400 };
  const logoBox = [375, 250, 500, 750] as [number, number, number, number];
  const readings = (px: Pixels) => {
    const result = measureLogo(px, logoBox, reference);
    if (result.status !== "measured") throw new Error(result.reason);
    return result;
  };

  it("passes a logo with room around it", () => {
    const measured = readings(canvas(800, logo, GREEN));
    expect(judgeLogo("logoClearSpace", measured, reference.fgHex).pass).toBe(true);
  });

  it("flags something inside the clear space and asks a person", () => {
    const px = canvas(800, logo, GREEN);
    for (let y = 418; y < 424; y++) for (let x = 300; x < 500; x++) px.data.set([20, 33, 61, 255], (y * 800 + x) * 4);
    const verdict = judgeLogo("logoClearSpace", readings(px), reference.fgHex);
    expect(verdict.pass).toBe(false);
    expect(verdict.needsReview).toBe(true);
  });
});

describe("logos in video frames", () => {
  const kit: BrandKit = { ...DEMO_KIT, logos: [{ name: "l", thumbnail: "data:image/png;base64,AA", aspect: 4, fgHex: "#0b8f5a" }] as BrandKit["logos"] };
  const good = { aspectDiff: 0.01, colourDelta: 1, fgHex: "#0b8f5a", clearSpaceIntrusion: 0 };
  const stretched = { ...good, aspectDiff: 0.4 };
  const input = (logos: (typeof good | null)[]): VideoInput => ({ name: "a.mp4", durationMs: 4000, width: 1080, height: 1920, sampledEveryMs: 1000, read: { status: "ran", model: "m", ms: 1, note: "" }, frames: logos.map((logo, i) => ({ ms: i * 1000, thumbnail: "data:image/jpeg;base64,AA", texts: [], logo })) });
  const shapeFindings = (logos: (typeof good | null)[]) => checkVideo(input(logos), kit).findings.filter((f) => f.cites.id === "R-6.7");

  it("reports a stretched logo once, at the first frame showing it", () => {
    const found = shapeFindings([good, stretched, stretched]);
    expect(found).toHaveLength(1);
    expect(found[0].frameMs).toBe(1000);
  });

  it("says nothing when the logo is fine or absent", () => {
    expect(shapeFindings([good, null])).toHaveLength(0);
  });

  it("still reports the logo when a saved video is checked again", () => {
    const { report } = checkVideo(input([stretched]), kit);
    expect(checkVideo(inputFromReport(report), kit).findings.some((f) => f.cites.id === "R-6.7")).toBe(true);
  });
});

describe("palette", () => {
  it("flags a large colour that isn't in the kit", () => {
    const px = canvas(320, { x0: 0, y0: 100, x1: 320, y1: 220 }, [123, 44, 191]);
    expect(judgeAreas(colorAreas(px, ["#0b8f5a"]), ["#0b8f5a"]).off).toHaveLength(1);
  });

  it("accepts the kit's own colour", () => {
    const px = canvas(320, { x0: 0, y0: 100, x1: 320, y1: 220 }, GREEN);
    expect(judgeAreas(colorAreas(px, ["#0b8f5a"]), ["#0b8f5a"]).off).toHaveLength(0);
  });
});

describe("alt text", () => {
  it("rejects a placeholder and accepts a description", () => {
    expect(altProblem("image")).toBeTruthy();
    expect(altProblem("A delivery rider handing a box of sweets to a customer at the door")).toBeFalsy();
  });
});
