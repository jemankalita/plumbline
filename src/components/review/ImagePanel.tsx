"use client";

import { Bot, Check, ImageUp, X } from "lucide-react";
import { useRef } from "react";
import type { ImageCheck, ImageInput, ImageReport, ImageVerdict, PaletteColor } from "@/lib/types";
import { Button, Card, cx, Pill } from "../ui";

export const VERDICT: Record<ImageVerdict, { word: string; cls: string }> = {
  aligned: { word: "Fits the brand", cls: "bg-green-50 text-green-700 ring-green/25" },
  partly: { word: "Partly fits", cls: "bg-amber-50 text-amber-700 ring-amber/25" },
  off: { word: "Off brand", cls: "bg-red-50 text-red-700 ring-red/25" },
};

/** The rule-by-rule result, shared by the workspace and the landing page. */
export function ImageChecks({ checks, brief }: { checks: ImageCheck[]; brief?: boolean }) {
  return (
    <ul className="grid gap-2">
      {checks.map((c) => (
        <li key={c.ruleId} className="grid grid-cols-[auto_1fr] gap-2 text-[14px]">
          <span className={cx("mt-0.5 grid size-5 place-items-center rounded-full", c.pass ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
            {c.pass ? <Check className="size-3" aria-label="Passed" /> : <X className="size-3" aria-label="Failed" />}
          </span>
          <span className="min-w-0">
            <span className="font-medium text-ink">{c.title}</span> <span className="num text-[13px] text-muted">{c.label}</span>
            {c.note && !brief && <span className="block text-[13px] text-muted">{c.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ImagePanel({
  image,
  report,
  palette,
  canReplace,
  busy,
  onReplace,
}: {
  image: ImageInput;
  report: ImageReport | null;
  palette: PaletteColor[];
  canReplace: boolean;
  busy: boolean;
  onReplace: (file: File) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-hair px-4 py-2.5">
        <p className="min-w-0 truncate text-[14px] font-medium text-ink">{image.name}</p>
        {report && <Pill className={VERDICT[report.verdict].cls}>{VERDICT[report.verdict].word}</Pill>}
        {canReplace && (
          <>
            <Button className="ml-auto" size="sm" variant="ghost" loading={busy} icon={<ImageUp className="size-3.5" />} onClick={() => fileRef.current?.click()}>
              Replace image
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              aria-label="Replace image"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReplace(f);
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="grid content-start gap-2">
          {image.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image.thumbnail} alt={image.altText || "Uploaded image, no alt text yet"} className="w-full rounded-md border border-line object-cover" />
          ) : (
            <div className="flex aspect-[3/2] overflow-hidden rounded-md border border-line">
              {image.colors.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
            <span className="mr-1">In the image</span>
            {image.colors.map((c) => (
              <span key={c} title={c} className="size-4 rounded-sm ring-1 ring-black/10" style={{ background: c }} />
            ))}
            <span className="ml-2 mr-1">Brand</span>
            {palette.map((p) => (
              <span key={p.hex} title={`${p.name} ${p.hex}`} className="size-4 rounded-sm ring-1 ring-black/10" style={{ background: p.hex }} />
            ))}
          </div>
          <p className="text-[13px] text-muted">
            Alt text: {image.altText?.trim() ? <span className="text-ink">“{image.altText}”</span> : <span className="text-red-700">missing</span>}
          </p>
        </div>

        {report ? (
          <div className="grid content-start gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <Bot className="size-3.5" aria-hidden /> What AI saw
              </p>
              <p className="mt-0.5 text-[14px] text-ink">{report.description || "No description came back."}</p>
              {report.visibleText && (
                <p className="mt-1 text-[13px] text-muted">
                  Words it read: <span className="text-ink">“{report.visibleText}”</span>
                </p>
              )}
            </div>
            <ImageChecks checks={report.checks} brief />
          </div>
        ) : (
          <div className="grid content-center gap-1 rounded-md bg-ash-50 p-4 text-[14px]">
            <p className="font-medium text-ink">AI has not looked at this image yet</p>
            <p className="text-[13px] text-muted">Colours and alt text were checked by code. Run the AI check below to judge the picture itself.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
