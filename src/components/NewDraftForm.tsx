"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bot, Check, FileUp, ImagePlus, Loader2, Lock, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { dominantColors } from "@/lib/engine/color";
import type { ImageInput, Role } from "@/lib/types";
import { api, Button, Card, cx, ErrorNote, Field, inputCls } from "./ui";

const CHANNELS = ["Instagram", "LinkedIn", "X / Twitter", "Email", "Website", "App store", "Press release", "Ad", "SMS", "Other"];

const SAMPLES = [
  {
    label: "Festive push notification",
    title: "Diwali push notification",
    channel: "SMS",
    ai: true,
    key: "Diwali sweets delivered fast",
    text: "Hurry guys!!! Last chance to get India's favourite Diwali sweets from Quick Kart. Over 5 lakh customers can't be wrong. Order now, risk-free!",
  },
  {
    label: "Clean product update",
    title: "Weekend newsletter intro",
    channel: "Email",
    ai: false,
    key: "free delivery above ₹199",
    text: "Your weekend groceries can be at your door in minutes. QuickKart now offers free delivery on orders above ₹199, across 40+ cities.",
  },
  {
    label: "Hiring post (inclusive language)",
    title: "Rider hiring post",
    channel: "LinkedIn",
    ai: true,
    key: "hiring in Guwahati",
    text: "We need young, energetic delivery boys in Guwahati. Earn the best pay in the city with QK Plus perks. Apply today, it is guaranteed income for hardworking men.",
  },
];

const STEPS = ["Rules & terminology", "Claims vs. approved facts", "Tone & messaging (AI)", "Verifier"];

export function NewDraftForm({ canSubmit, role }: { canSubmit: boolean; role: Role }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState("Instagram");
  const [aiAssisted, setAiAssisted] = useState(false);
  const [keyMessage, setKeyMessage] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<ImageInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function readDoc(file: File) {
    setError(null);
    setParsing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ text: string; name: string; truncated: boolean }>("/api/parse", { form });
      setText(res.text);
      if (!title) setTitle(res.name.replace(/\.[^.]+$/, ""));
      if (res.truncated) setError("That file was long, so only the first 60,000 characters were loaded.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setParsing(false);
    }
  }

  async function readImage(file: File) {
    setError(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Images must be PNG, JPEG or WebP.");
    if (file.size > 8 * 1024 * 1024) return setError("Images must be 8 MB or smaller.");
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Couldn't read that image."));
        el.src = url;
      });
      const draw = (max: number) => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * k));
        c.height = Math.max(1, Math.round(img.height * k));
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        return { c, ctx };
      };
      const small = draw(120);
      const colors = dominantColors(small.ctx.getImageData(0, 0, small.c.width, small.c.height).data, 4);
      const thumb = draw(480).c.toDataURL("image/jpeg", 0.78);
      URL.revokeObjectURL(url);
      setImage({ name: file.name, altText: "", colors, thumbnail: thumb.length < 380_000 ? thumb : null });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!text.trim()) return setError("Paste or upload some content first.");
    setRunning(true);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 700);
    try {
      const res = await api<{ id: string }>("/api/submissions", {
        body: { title: title.trim() || "Untitled draft", channel, aiAssisted, keyMessage: keyMessage.trim() || null, text, image },
      });
      setStep(STEPS.length);
      router.push(`/s/${res.id}`);
    } catch (err) {
      setError((err as Error).message);
      setRunning(false);
    } finally {
      clearInterval(timer);
    }
  }

  async function becomeCreator() {
    await api("/api/role", { body: { role: "creator" } });
    router.refresh();
  }

  if (!canSubmit) {
    return (
      <Card className="flex flex-wrap items-center gap-4 px-5 py-5">
        <Lock className="size-5 text-ash-600" />
        <p className="text-sm text-ink">
          You&apos;re acting as <b className="font-medium capitalize text-ink">{role}</b>. Only creators and admins submit drafts.
        </p>
        <Button className="ml-auto" variant="primary" onClick={becomeCreator}>
          Switch to Creator
        </Button>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <Card className="overflow-hidden">
        <div
          className={cx("relative transition-colors", dragging && "bg-ash-50")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (!f) return;
            if (f.type.startsWith("image/")) readImage(f);
            else readDoc(f);
          }}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-hair px-4 py-2.5">
            <p className="kicker">Content</p>
            <span className="num ml-auto text-[13px] text-muted">{text.length.toLocaleString()} / 20,000</span>
            <Button type="button" size="sm" variant="ghost" loading={parsing} icon={<FileUp className="size-3.5" />} onClick={() => fileRef.current?.click()}>
              Upload .docx / .pdf / .md
            </Button>
            <input ref={fileRef} type="file" accept=".docx,.pdf,.md,.markdown,.txt" hidden onChange={(e) => e.target.files?.[0] && readDoc(e.target.files[0])} />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            maxLength={20000}
            aria-label="Draft content"
            placeholder="Paste a caption, email, ad or web copy… or drop a file here."
            className="block min-h-[260px] w-full resize-y bg-transparent px-5 py-4 font-display text-[22px] leading-[1.55] text-ink outline-none placeholder:text-muted/50"
          />
          {dragging && (
            <div className="pointer-events-none absolute inset-2 grid place-items-center rounded-xl border-2 border-dashed border-ash-400 bg-ash-50/80 text-sm font-medium text-ash-700">
              Drop to load text or image
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-hair bg-ash-50/50 px-4 py-3">
          <span className="flex items-center gap-1 text-[13px] text-muted">
            <Sparkles className="size-3.5 text-ash-500" /> Try a sample:
          </span>
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setTitle(s.title);
                setChannel(s.channel);
                setAiAssisted(s.ai);
                setKeyMessage(s.key);
                setText(s.text);
              }}
              className="rounded-full border border-line bg-white px-2.5 py-1 text-[13px] text-ink transition-colors hover:border-ash-300 hover:text-ink"
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:sticky lg:top-20">
        <Card className="grid gap-4 p-5">
          <Field label="Title" htmlFor="title">
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="e.g. Diwali offer · Instagram caption" className={inputCls} />
          </Field>
          <Field label="Channel" htmlFor="channel">
            <select id="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={inputCls}>
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Key message (intent lock)" htmlFor="key" hint="Fixes that would remove these words are flagged instead of offered as one-click.">
            <input id="key" value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} maxLength={200} placeholder="e.g. Diwali delivery offer" className={inputCls} />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:border-ash-300">
            <input type="checkbox" checked={aiAssisted} onChange={(e) => setAiAssisted(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-ash-600)]" />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <Bot className="size-4 text-ash-600" /> Drafted with AI
              </span>
              <span className="block text-[13px] text-muted">Tagged so Insights can compare AI and human drafts.</span>
            </span>
          </label>
        </Card>

        <Card className="p-5">
          <p className="text-[13px] font-medium text-ink">Image (optional)</p>
          {image ? (
            <div className="mt-3 grid gap-3">
              <div className="flex gap-3">
                {image.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.thumbnail} alt="" className="size-20 rounded-lg border border-line object-cover" />
                ) : (
                  <div className="size-20 rounded-lg border border-line bg-ash-50" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{image.name}</p>
                  <div className="mt-1.5 flex gap-1">
                    {image.colors.map((c) => (
                      <span key={c} title={c} className="size-5 rounded ring-1 ring-black/10" style={{ background: c }} />
                    ))}
                  </div>
                  <button type="button" onClick={() => setImage(null)} className="mt-2 inline-flex items-center gap-1 text-[13px] text-red-700 hover:underline">
                    <Trash2 className="size-3" /> Remove
                  </button>
                </div>
              </div>
              <Field label="Alt text" htmlFor="alt" hint="Leave empty to see the accessibility check (and an AI-drafted suggestion).">
                <input id="alt" value={image.altText ?? ""} onChange={(e) => setImage({ ...image, altText: e.target.value })} maxLength={500} className={inputCls} />
              </Field>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imgRef.current?.click()}
              className="mt-3 grid w-full place-items-center gap-1.5 rounded-xl border border-dashed border-ash-300 bg-ash-50/50 px-4 py-6 text-sm text-ash-700 transition-colors hover:bg-ash-50"
            >
              <ImagePlus className="size-5" />
              Add a banner or post image
              <span className="text-[13px] text-muted">Colours are read in your browser. Only a small thumbnail is sent.</span>
            </button>
          )}
          <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0])} />
        </Card>

        <AnimatePresence>{error && <ErrorNote error={error} />}</AnimatePresence>

        <Button type="submit" variant="primary" className="h-12 text-[15px]" loading={running} disabled={!text.trim() || parsing}>
          {running ? "Checking…" : "Run the brand check"}
        </Button>

        <AnimatePresence>
          {running && (
            <motion.ol initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-1.5 rounded-2xl border border-line bg-white p-4">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cx(
                      "grid size-5 place-items-center rounded-full text-[13px] transition-colors",
                      i < step ? "bg-green text-white" : i === step ? "bg-ash-100 text-ash-700" : "bg-ash-50 text-muted"
                    )}
                  >
                    {i < step ? <Check className="size-3" /> : i === step ? <Loader2 className="size-3 animate-spin" /> : i + 1}
                  </span>
                  <span className={i <= step ? "text-ink" : "text-muted"}>{s}</span>
                </li>
              ))}
            </motion.ol>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
