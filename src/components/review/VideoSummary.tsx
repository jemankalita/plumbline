import type { VideoReport } from "@/lib/types";

const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

/** What was checked in a video, and how much of it. Says plainly what was not checked. */
export function VideoSummary({ video }: { video: VideoReport }) {
  const seconds = (video.sampledEveryMs / 1000).toFixed(1);
  return (
    <section className="rounded-lg border border-line bg-white p-4 text-[14px]">
      <p className="font-medium text-ink">{video.name}</p>
      <p className="mt-1 text-muted">
        {clock(video.durationMs)} long · {video.width}×{video.height} · the opening is sampled closely, then about every {seconds} s. Plumbline reads words on screen. It does not hear speech.
      </p>
      {video.read.status !== "ran" && <p className="mt-2 text-amber-700">{video.read.note}</p>}
      {video.frames.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {video.frames.map((f) =>
            f.thumbnail ? (
              <li key={f.ms} className="text-[13px] text-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.thumbnail} alt={`Video frame at ${clock(f.ms)}`} className="h-28 rounded-md border border-line object-cover" />
                <span className="num">{clock(f.ms)}</span>
              </li>
            ) : null
          )}
        </ul>
      )}
    </section>
  );
}
