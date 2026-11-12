// Browser side of video. Frames are taken here so the file itself never leaves the device.

import { frameChange, pickChangedTimes, sampleTimes, scanTimes } from "./engine/video";
import type { VideoInput } from "./types";

const MAX_BYTES = 300 * 1024 * 1024;
const MAX_SECONDS = 600;
const FULL_EDGE = 1024;
const THUMB_EDGE = 240;
const THUMB_QUALITY = 0.6;
const MAX_TOTAL_CHARS = 3_500_000; // stays under the 4.5 MB request limit on the host
const FALLBACK_FRAMES = 12;
const SEEK_TIMEOUT_MS = 8000;
const SCAN_EDGE = 48;
const SCAN_PROGRESS_FRAMES = 20;
const ENCODINGS = [
  { edge: 1024, quality: 0.72 },
  { edge: 1024, quality: 0.55 },
  { edge: 768, quality: 0.6 },
  { edge: 640, quality: 0.5 },
];

export interface SentFrame {
  ms: number;
  dataUrl: string;
}

export interface PreparedVideo {
  video: Omit<VideoInput, "read">;
  send: SentFrame[];
}

type Grabbed = { ms: number; canvas: HTMLCanvasElement };
export type FrameProgress = (done: number, total: number) => void;

function copyFrame(source: CanvasImageSource, width: number, height: number, edge: number): HTMLCanvasElement {
  const k = Math.min(1, edge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * k));
  canvas.height = Math.max(1, Math.round(height * k));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't read video frames.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

type CanvasFrames = { canvasesAtTimestamps(times: number[]): AsyncIterable<{ canvas: unknown } | null> };

/** A quick low-resolution pass that says how much the picture changed at each candidate time. */
async function scanChanges(sink: CanvasFrames, times: number[], width: number, height: number, onFrame: FrameProgress) {
  const scans: { t: number; change: number }[] = [];
  let previous: Uint8ClampedArray | null = null;
  let index = 0;
  for await (const frame of sink.canvasesAtTimestamps(times)) {
    const t = times[index++];
    onFrame(index, times.length + SCAN_PROGRESS_FRAMES);
    if (!frame) continue;
    const small = copyFrame(frame.canvas as CanvasImageSource, width, height, SCAN_EDGE);
    const data: Uint8ClampedArray = (small.getContext("2d") as CanvasRenderingContext2D).getImageData(0, 0, small.width, small.height).data;
    scans.push({ t, change: previous ? frameChange(previous, data) : 0 });
    previous = data;
  }
  return scans;
}

async function withMediabunny(file: File, onFrame: FrameProgress) {
  const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import("mediabunny");
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("no video track");
    if (!(await track.canDecode())) throw new Error("codec not decodable here");
    const seconds = await track.computeDuration();
    const width = track.displayWidth;
    const height = track.displayHeight;
    const sink = new CanvasSink(track, { poolSize: 1 });
    const candidates = scanTimes(seconds);
    const scans = await scanChanges(sink, candidates, width, height, onFrame).catch((error: unknown) => {
      console.warn("[plumbline] change scan failed, using even sampling", error);
      return [];
    });
    const times = scans.length ? pickChangedTimes(seconds, scans) : sampleTimes(seconds);
    const total = candidates.length + times.length;
    const frames: Grabbed[] = [];
    let index = 0;
    for await (const frame of sink.canvasesAtTimestamps(times)) {
      if (frame) frames.push({ ms: Math.round(times[index] * 1000), canvas: copyFrame(frame.canvas as CanvasImageSource, width, height, FULL_EDGE) });
      index++;
      onFrame(candidates.length + index, total);
    }
    return { seconds, width, height, frames };
  } finally {
    input.dispose();
  }
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("seek timed out")), SEEK_TIMEOUT_MS);
    video.onseeked = () => {
      clearTimeout(timer);
      resolve();
    };
    video.currentTime = time;
  });
}

/** Slower and less exact, but works for anything the browser itself can play. */
async function withVideoElement(file: File, onFrame: FrameProgress) {
  const url = URL.createObjectURL(file);
  const el = document.createElement("video");
  el.muted = true;
  el.preload = "auto";
  el.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      el.onloadeddata = () => resolve();
      el.onerror = () => reject(new Error("unplayable"));
    });
    const seconds = el.duration;
    const times = Array.from({ length: FALLBACK_FRAMES }, (_, i) => (Math.max(0, seconds - 0.05) * i) / (FALLBACK_FRAMES - 1));
    const frames: Grabbed[] = [];
    for (const [index, time] of times.entries()) {
      await seekTo(el, time);
      frames.push({ ms: Math.round(time * 1000), canvas: copyFrame(el, el.videoWidth, el.videoHeight, FULL_EDGE) });
      onFrame(index + 1, times.length);
    }
    return { seconds, width: el.videoWidth, height: el.videoHeight, frames };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The largest quality that fits one request. */
function encode(frames: Grabbed[]): SentFrame[] {
  for (const { edge, quality } of ENCODINGS) {
    const sent = frames.map(({ ms, canvas }) => ({ ms, dataUrl: copyFrame(canvas, canvas.width, canvas.height, edge).toDataURL("image/jpeg", quality) }));
    if (sent.reduce((total, f) => total + f.dataUrl.length, 0) <= MAX_TOTAL_CHARS) return sent;
  }
  throw new Error("Those frames are too detailed to send. Try a shorter clip.");
}

function medianGap(ms: number[]): number {
  const gaps = ms.slice(1).map((t, i) => t - ms[i]).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 0;
}

/** Reads a clip in the browser. Throws a readable Error. */
export async function prepareVideo(file: File, onFrame: FrameProgress): Promise<PreparedVideo> {
  if (file.size > MAX_BYTES) throw new Error("Videos must be 300 MB or smaller.");
  const read = await withMediabunny(file, onFrame).catch(() => withVideoElement(file, onFrame).catch(() => null));
  if (!read?.frames.length) throw new Error("Couldn't read that video. Try an MP4 saved as H.264.");
  if (read.seconds > MAX_SECONDS) throw new Error("Videos must be 10 minutes or shorter.");
  const send = encode(read.frames);
  return {
    send,
    video: {
      name: file.name,
      durationMs: Math.round(read.seconds * 1000),
      width: read.width,
      height: read.height,
      sampledEveryMs: medianGap(read.frames.map((f) => f.ms)),
      sampledMs: read.frames.map((f) => f.ms),
      frames: read.frames.map(({ ms, canvas }) => ({ ms, thumbnail: copyFrame(canvas, canvas.width, canvas.height, THUMB_EDGE).toDataURL("image/jpeg", THUMB_QUALITY), texts: [] })),
    },
  };
}
