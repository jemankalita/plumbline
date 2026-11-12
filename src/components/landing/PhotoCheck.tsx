"use client";

import { Bot, ImageUp } from "lucide-react";
import { useRef, useState } from "react";
import { DEMO_IMAGES, type DemoImage } from "@/lib/demo-images";
import { prepareDemoImage, prepareImage } from "@/lib/image-prep";
import type { ImageInput, ReviewResult } from "@/lib/types";
import { ImageChecks, VERDICT } from "../review/ImagePanel";
import { aiSummary } from "../review/AiActivity";
import { AiWorking } from "../AiWorking";
import { api, cx, ErrorNote, Pill, ScoreRing, SeverityBadge } from "../ui";
import { EmptyResult } from "./EmptyResult";
import { Reveal } from "./Landing";
import { WordsReveal } from "./Motion";

type Picked = { image: ImageInput; preview: string };

/** Live image check on the landing page. Real AI call, nothing stored. */
export function PhotoCheck({ aiOn }: { aiOn: boolean }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [res, setRes] = useState<ReviewResult | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function check(id: string, prepare: () => Promise<ImageInput>, preview?: string) {
    setActive(id);
    setBusy(true);
    setError(null);
    setRes(null);
    try {
      const image = await prepare();
      setPicked({ image, preview: preview ?? image.thumbnail ?? "" });
      setRes(await api<ReviewResult>("/api/review", { body: { text: "", image } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pickDemo = (d: DemoImage) => check(d.src, () => prepareDemoImage(d.src, d.name, d.alt), d.src);
  const report = res?.imageReport ?? null;
  const others = (res?.findings ?? []).filter((f) => !(f.ai && f.cites.kind === "rule" && report?.checks.some((c) => c.ruleId === f.cites.id)));

  return (
    <section id="photos" className="scroll-mt-4 bg-ash-50 px-[var(--margin)] py-[clamp(72px,8vw,128px)] text-soot">
      <Reveal>
        <WordsReveal className="display text-[36px] lg:text-[clamp(40px,4.4vw,64px)]" text="Check a photo" />
        <p className="mt-4 max-w-[60ch] text-[17px] leading-[1.55] lg:text-[18px]">
          {aiOn
            ? "AI looks at the picture and judges it against the Brand Kit's image rules. It reads any words too, and plain code checks those for wrong names and unproven claims. Nothing is saved."
            : "AI is off on this server, so only colours and alt text can be checked by code."}
        </p>
      </Reveal>

      <div className="mt-10 grid items-start gap-1.5 lg:grid-cols-2">
        <Reveal i={1}>
          <div data-ui className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
            {DEMO_IMAGES.map((d) => (
              <button
                key={d.src}
                onClick={() => pickDemo(d)}
                disabled={busy}
                aria-pressed={active === d.src}
                className={cx("group bg-white p-1.5 text-left transition-shadow disabled:cursor-wait", active === d.src ? "ring-2 ring-soot" : "hover:ring-1 hover:ring-ash-400")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.src} alt="" className="aspect-[3/2] w-full object-cover" />
                <span className="block px-1.5 pb-1 pt-2 text-[15px] font-medium">{d.label}</span>
                <span className="block px-1.5 pb-1.5 text-[13px] text-muted">{d.hint}</span>
              </button>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className={cx("grid min-h-[150px] place-items-center bg-white p-4 text-center transition-shadow hover:ring-1 hover:ring-ash-400 disabled:cursor-wait", active === "upload" && "ring-2 ring-soot")}
            >
              <span className="grid justify-items-center gap-1.5">
                <ImageUp className="size-5" aria-hidden />
                <span className="text-[15px] font-medium">Use your own</span>
                <span className="text-[13px] text-muted">PNG, JPEG or WebP</span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              aria-label="Upload an image to check"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) check("upload", () => prepareImage(f, f.name));
                e.target.value = "";
              }}
            />
          </div>
        </Reveal>

        <Reveal i={2}>
          <div data-ui className={cx("bg-white p-5", (busy || res) && "min-h-[320px]")} aria-live="polite">
            <ErrorNote error={error} />
            {busy && <Working picked={picked} aiOn={aiOn} />}
            {!busy && !res && !error && <EmptyResult title="Pick a picture to run a live check." rows={["Colours against the palette", "Logo shape and clear space", "Alt text and words in the image"]} />}
            {!busy && res && (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <ScoreRing score={res.score} size={60} />
                  {report && <Pill className={VERDICT[report.verdict].cls}>{VERDICT[report.verdict].word}</Pill>}
                  <p className="flex items-center gap-1.5 text-[14px] text-muted">
                    <Bot className="size-4" aria-hidden /> {aiSummary(res.ai)}
                    {res.ai.provider ? ` · ${res.ai.provider}` : ""}
                  </p>
                </div>
                {report && (
                  <>
                    <p className="text-[16px]">{report.description}</p>
                    {report.visibleText && <p className="text-[14px] text-muted">Words it read: “{report.visibleText}”</p>}
                    <ImageChecks checks={report.checks} />
                  </>
                )}
                {!report && <p className="text-[15px] text-muted">{res.ai.calls.find((c) => c.pass === "image")?.returned ?? res.ai.note}</p>}
                {others.length > 0 && (
                  <ul className="grid gap-2 border-t border-hair pt-3">
                    {others.map((f) => (
                      <li key={f.id} className="grid gap-1">
                        <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                          <SeverityBadge s={f.severity} /> {f.cites.label}
                        </span>
                        <span className="text-[14px] text-muted">{f.start < 0 && f.quote.startsWith("Text on") ? `${f.quote}. ${f.message}` : f.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Reveal>
      </div>

      <p className="mt-6 max-w-[68ch] text-[14px] text-muted">Photos and video, including Instagram Reels and YouTube Shorts. For video, AI reads the words on screen from still frames, and it does not hear speech.</p>
    </section>
  );
}

function Working({ picked, aiOn }: { picked: Picked | null; aiOn: boolean }) {
  return (
    <AiWorking
      images={picked?.preview ? [picked.preview] : []}
      title={aiOn ? "AI is looking at the picture" : "Checking colours and alt text"}
      checks={
        aiOn
          ? ["Judging it against the kit's image rules", "Reading any words on the picture", "Looking for the brand's logo", "Comparing its colours with the palette"]
          : ["Comparing its colours with the palette", "Checking the alt text"]
      }
      hint={aiOn ? "Usually 5 to 25 seconds. Nothing is saved." : "Takes about a second. Nothing is saved."}
    />
  );
}
