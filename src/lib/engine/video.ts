// Video checks. AI only reads the words on screen. Code joins those readings into on-screen
// captions, then applies the same term and claim rules used for any other text.

import { distance } from "fastest-levenshtein";
import type { BrandKit, Finding, Rule, VideoFrame, VideoInput, VideoReport, VideoTextBox, VideoTrack } from "../types";
import { checkClaims } from "./claims";
import { isLogoRuleKind, judgeLogo } from "./logo";
import { patternProblem } from "./regex-safety";
import { checkTerms, checkTextRules } from "./rules";
import { uid } from "./text";

const MAX_FRAMES = 20;
const OPENING_SECONDS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const SAME_TEXT = 0.8;
const SAME_PLACE = 0.2;
const MAX_MISSED_SAMPLES = 1;
const READ_CONFIDENCE = 0.85;
const RATIO_TOLERANCE = 0.03;
const LOGO_CONFIDENCE = 0.9;
const MAX_SCANS = 90;
const MIN_SCAN_STEP_SECONDS = 1;
const MIN_CHANGE = 0.02;

/** Each channel's required shape. Times are the plan's limits for short-form video. */
export const VIDEO_SPECS: Record<string, { ratio: number; ratioLabel: string; maxSeconds: number }> = {
  Reels: { ratio: 9 / 16, ratioLabel: "9:16", maxSeconds: 90 },
  Shorts: { ratio: 9 / 16, ratioLabel: "9:16", maxSeconds: 180 },
};

/** Opening seconds closely, because that's where hooks and offers sit, then evenly up to the last frame. */
export function sampleTimes(durationSeconds: number): number[] {
  const last = Math.max(0, durationSeconds - 0.05);
  const opening = OPENING_SECONDS.filter((t) => t < last);
  const room = MAX_FRAMES - opening.length - 1;
  const from = opening[opening.length - 1] ?? 0;
  const between = Array.from({ length: Math.max(0, room) }, (_, i) => from + ((last - from) * (i + 1)) / (room + 1));
  return [...new Set([...opening, ...between, last].map((t) => Math.round(t * 1000) / 1000))].sort((a, b) => a - b);
}

/** Times to look at cheaply, to find where the picture changes. */
export function scanTimes(durationSeconds: number): number[] {
  const last = Math.max(0, durationSeconds - 0.05);
  const from = OPENING_SECONDS[OPENING_SECONDS.length - 1];
  if (last <= from) return [];
  const count = Math.min(MAX_SCANS, Math.floor((last - from) / MIN_SCAN_STEP_SECONDS));
  return Array.from({ length: count }, (_, i) => Math.round((from + ((last - from) * (i + 1)) / (count + 1)) * 1000) / 1000);
}

/** How different two same-sized pictures are, from 0 (identical) to 1. */
export function frameChange(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let total = 0;
  let count = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 4) {
    total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    count += 3;
  }
  return count ? total / (count * 255) : 0;
}

/**
 * Keeps the opening and the last frame, and spends the rest where the picture changes most.
 * Each slot has its own stretch of the clip, so a busy moment can't leave the rest unwatched.
 */
export function pickChangedTimes(durationSeconds: number, scans: { t: number; change: number }[]): number[] {
  const even = sampleTimes(durationSeconds);
  const last = even[even.length - 1];
  const opening = even.filter((t) => OPENING_SECONDS.includes(t));
  const between = even.filter((t) => !opening.includes(t) && t !== last);
  if (!between.length || !scans.length) return even;
  const from = opening[opening.length - 1] ?? 0;
  const width = (last - from) / between.length;
  const picked = between.map((fallback, i) => {
    const low = from + width * i;
    const inSlot = scans.filter((s) => s.t > low && s.t <= low + width && s.change >= MIN_CHANGE);
    return inSlot.sort((a, b) => b.change - a.change || a.t - b.t)[0]?.t ?? fallback;
  });
  return [...new Set([...opening, ...picked, last])].sort((a, b) => a - b);
}

const normalise = (text: string) =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest === 0 ? 1 : 1 - distance(a, b) / longest;
}

function overlap(a: VideoTextBox | null | undefined, b: VideoTextBox | null | undefined): number {
  if (!a || !b) return 1; // no position to compare, so only the words decide
  const w = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  const h = Math.min(a[2], b[2]) - Math.max(a[0], b[0]);
  if (w <= 0 || h <= 0) return 0;
  const area = (x: VideoTextBox) => (x[2] - x[0]) * (x[3] - x[1]);
  return (w * h) / (area(a) + area(b) - w * h);
}

interface OpenTrack extends VideoTrack {
  lastIndex: number;
  key: string;
  spellings: Map<string, number>;
}

/** Joins the same words across neighbouring frames into one caption with a start and end time. */
export function buildTracks(frames: Pick<VideoFrame, "ms" | "texts">[]): VideoTrack[] {
  const tracks: OpenTrack[] = [];
  [...frames]
    .sort((a, b) => a.ms - b.ms)
    .forEach((frame, index) => {
      for (const read of frame.texts) {
        const key = normalise(read.text);
        if (!key) continue;
        const match = tracks.find((t) => index - t.lastIndex <= MAX_MISSED_SAMPLES + 1 && t.lastIndex !== index && similarity(t.key, key) >= SAME_TEXT && overlap(t.box, read.box) >= SAME_PLACE);
        if (match) {
          match.endMs = frame.ms;
          match.lastIndex = index;
          match.spellings.set(read.text, (match.spellings.get(read.text) ?? 0) + 1);
        } else {
          tracks.push({ text: read.text, startMs: frame.ms, endMs: frame.ms, box: read.box ?? null, lastIndex: index, key, spellings: new Map([[read.text, 1]]) });
        }
      }
    });
  return tracks.map(({ startMs, endMs, box, spellings }) => ({
    text: [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0],
    startMs,
    endMs,
    box,
  }));
}

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

function formatFindings(video: VideoInput, channel: string | undefined, kit: BrandKit): Finding[] {
  const spec = channel ? VIDEO_SPECS[channel] : undefined;
  const rule: Rule | undefined = kit.rules.find((r) => r.check?.kind === "videoFormat");
  if (!spec || !rule) return [];
  const problems: string[] = [];
  const ratio = video.width / video.height;
  if (Math.abs(ratio - spec.ratio) > RATIO_TOLERANCE) problems.push(`it is ${video.width}×${video.height}, not ${spec.ratioLabel}`);
  if (video.durationMs > spec.maxSeconds * 1000) problems.push(`it runs ${Math.round(video.durationMs / 1000)} s, over the ${spec.maxSeconds} s limit`);
  return problems.map((p) => ({
    id: uid(),
    pass: "video",
    type: rule.category,
    severity: rule.severity,
    start: -1,
    end: -1,
    quote: video.name,
    message: `For ${channel}, ${p}.`,
    cites: { kind: "rule", id: rule.id, label: `Rule ${rule.section}`, excerpt: rule.text },
    fix: null,
    confidence: 1,
    needsReview: false,
    ai: false,
    status: "open",
  }));
}

function textFindings(tracks: VideoTrack[], kit: BrandKit, today?: Date): Finding[] {
  const seen = new Set<string>();
  return tracks.flatMap((track) =>
    [...checkTerms(track.text, kit), ...checkTextRules(track.text, kit), ...checkClaims(track.text, kit, today).findings]
      .filter((f) => f.type !== "readability" && f.severity !== "suggestion") // style rules are for body copy, not captions
      .filter((f) => {
        const key = `${f.cites.id}|${normalise(f.quote)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((f) => ({
        ...f,
        id: uid(),
        pass: "video" as const,
        start: -1,
        end: -1,
        quote: `On screen: “${f.quote}”`,
        message: `${f.message} Seen at ${clock(track.startMs)}.`,
        frameMs: track.startMs,
        confidence: READ_CONFIDENCE,
        ai: true,
      }))
  );
}

const wholeSeconds = (ms: number) => (Math.round(ms / 100) / 10).toString();

/** We only see sampled frames, so time on screen is a range. A range that crosses the limit goes to a person. */
function onScreenFindings(tracks: VideoTrack[], video: VideoInput, kit: BrandKit): Finding[] {
  const times = [...(video.sampledMs ?? video.frames.map((f) => f.ms))].sort((a, b) => a - b);
  return kit.rules.flatMap((rule) => {
    if (rule.check?.kind !== "minOnScreen" || patternProblem(rule.check.pattern, "i")) return [];
    const matcher = new RegExp(rule.check.pattern, "i");
    const { seconds } = rule.check;
    return tracks.filter((track) => matcher.test(track.text)).flatMap((track) => {
      const shortest = track.endMs - track.startMs;
      if (shortest >= seconds * 1000) return [];
      const longest = (times.find((t) => t > track.endMs) ?? video.durationMs) - (times.filter((t) => t < track.startMs).at(-1) ?? 0);
      const isBorderline = longest >= seconds * 1000;
      const held = isBorderline ? `between ${wholeSeconds(shortest)} and ${wholeSeconds(longest)} s` : `at most ${wholeSeconds(longest)} s`;
      return [{
        id: uid(),
        pass: "video" as const,
        type: rule.category,
        severity: rule.severity,
        start: -1,
        end: -1,
        quote: `On screen: “${track.text}”`,
        message: `On screen for ${held}. The rule needs ${seconds} s${isBorderline ? ", so a person should check" : ""}. Seen at ${clock(track.startMs)}.`,
        cites: { kind: "rule" as const, id: rule.id, label: `Rule ${rule.section}`, excerpt: rule.text },
        fix: null,
        confidence: READ_CONFIDENCE,
        needsReview: isBorderline,
        ai: true,
        status: "open" as const,
        frameMs: track.startMs,
      }];
    });
  });
}

/** One finding per logo rule, at the first frame that breaks it. */
function logoFindings(video: VideoInput, kit: BrandKit): Finding[] {
  const original = kit.logos?.[0];
  if (!original) return [];
  return kit.rules.flatMap((rule) => {
    const kind = rule.check?.kind;
    if (!isLogoRuleKind(kind)) return [];
    const broken = [...video.frames]
      .sort((a, b) => a.ms - b.ms)
      .flatMap((frame) => {
        const verdict = frame.logo ? judgeLogo(kind, frame.logo, original.fgHex) : null;
        return verdict && !verdict.pass ? [{ ms: frame.ms, verdict }] : [];
      })[0];
    if (!broken) return [];
    return [{
      id: uid(),
      pass: "video" as const,
      type: rule.category,
      severity: rule.severity,
      start: -1,
      end: -1,
      quote: rule.title,
      message: `${broken.verdict.note} Seen at ${clock(broken.ms)}.`,
      cites: { kind: "rule" as const, id: rule.id, label: `Rule ${rule.section}`, excerpt: rule.text },
      fix: null,
      confidence: LOGO_CONFIDENCE,
      needsReview: broken.verdict.needsReview,
      ai: true,
      status: "open" as const,
      frameMs: broken.ms,
    }];
  });
}

export interface VideoCheck {
  findings: Finding[];
  report: VideoReport;
}

/** Runs every video check and keeps only the frames a person needs to see. */
export function checkVideo(video: VideoInput, kit: BrandKit, channel?: string, today?: Date): VideoCheck {
  const tracks = video.tracks ?? buildTracks(video.frames);
  const findings = [...textFindings(tracks, kit, today), ...onScreenFindings(tracks, video, kit), ...logoFindings(video, kit), ...formatFindings(video, channel, kit)];
  const flagged = new Set(findings.flatMap((f) => (f.frameMs == null ? [] : [f.frameMs])));
  const { name, durationMs, width, height, sampledEveryMs, sampledMs, read } = video;
  return {
    findings,
    report: {
      name,
      durationMs,
      width,
      height,
      sampledEveryMs,
      sampledMs: sampledMs ?? video.frames.map((f) => f.ms),
      read,
      tracks,
      frames: video.frames.filter((f) => flagged.has(f.ms) && f.thumbnail).map(({ ms, thumbnail, logo }) => ({ ms, thumbnail, logo })),
    },
  };
}

/** A saved report can be checked again when only the words of a draft change. */
export function inputFromReport(report: VideoReport): VideoInput {
  return { ...report, frames: report.frames.map((f) => ({ ...f, texts: [] })) };
}
