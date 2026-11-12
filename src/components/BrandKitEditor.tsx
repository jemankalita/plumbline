"use client";

import { AnimatePresence, motion } from "motion/react";
import { Cpu, FileUp, Lock, Pencil, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { BrandKit, Fact, IssueType, Rule, RuleCheck, Severity, Term } from "@/lib/types";
import { api, Button, Card, cx, ErrorNote, Field, inputCls, ISSUE, Pill, SeverityBadge } from "./ui";

type Tab = "rules" | "terms" | "facts" | "voice" | "import";
type Editing = { kind: "rules"; item: Partial<Rule> } | { kind: "terms"; item: Partial<Term> } | { kind: "facts"; item: Partial<Fact> } | null;

const CHECK_LABEL: Record<RuleCheck["kind"], string> = {
  pattern: "Pattern",
  maxSentenceWords: "Sentence length",
  superlative: "Claims register",
  altText: "Alt text",
  contrast: "WCAG contrast",
  palette: "Palette match",
  vision: "AI looks at the image",
  videoFormat: "Video shape and length",
  minOnScreen: "Time on screen",
  logoDistortion: "Logo proportions",
  logoColour: "Logo colour",
  logoClearSpace: "Logo clear space",
};

const isAiCheck = (c: RuleCheck) => c.kind === "vision";

function daysUntil(date: string, today: string) {
  return Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86400000);
}

export function BrandKitEditor({ kit, canEdit, aiOn, today }: { kit: BrandKit; canEdit: boolean; aiOn: boolean; today: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("rules");
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const expired = kit.facts.filter((f) => f.expiresOn && daysUntil(f.expiresOn, today) < 0).length;
  // "vision" rules are stored with a check, but AI judges them, so they count as AI-judged.
  const judgement = kit.rules.filter((r) => !r.check || isAiCheck(r.check)).length;

  async function save(kind: "rules" | "terms" | "facts", item: object) {
    setBusy("save");
    setError(null);
    try {
      await api("/api/kit", { body: { kind, item } });
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: "rules" | "terms" | "facts", id: string) {
    setBusy(id);
    setError(null);
    try {
      await api(`/api/kit?kind=${kind}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const TABS: { id: Tab; label: string; n?: number }[] = [
    { id: "rules", label: "Rules", n: kit.rules.length },
    { id: "terms", label: "Terminology", n: kit.terms.length },
    { id: "facts", label: "Approved facts", n: kit.facts.length },
    { id: "voice", label: "Voice & palette" },
    { id: "import", label: "Import guidelines" },
  ];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Source of truth</p>
          <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-[-0.03em] text-ink">{kit.name} Brand Kit</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted">
            Every finding must cite one of these records. Change a rule here and the next check uses it straight away.
          </p>
        </div>
        <dl className="flex gap-6 text-sm">
          <Stat n={kit.rules.length - judgement} label="rules checked by code" />
          <Stat n={judgement} label="AI-judged rules" />
          <Stat n={expired} label="expired facts" hot={expired > 0} />
        </dl>
      </div>

      {!canEdit && (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink">
          <Lock className="size-4 text-ash-600" /> Read-only. Switch to <b className="font-medium text-ink">Admin</b> in the top bar to edit the kit.
        </p>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-white p-1 ring-1 ring-line text-sm sm:w-fit" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cx("relative shrink-0 rounded-lg px-3 py-1.5 transition-colors", tab === t.id ? "font-medium text-white" : "text-ink hover:bg-ash-50")}
          >
            {tab === t.id && <motion.span layoutId="kit-tab" className="absolute inset-0 rounded-md bg-soot" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">
              {t.label} {t.n != null && <span className="num opacity-70">{t.n}</span>}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence>{error && <ErrorNote error={error} />}</AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }} transition={{ duration: 0.22 }}>
          {tab === "rules" && (
            <List
              canEdit={canEdit}
              onAdd={() => setEditing({ kind: "rules", item: { severity: "warning", category: "tone", check: null } })}
              addLabel="Add rule"
            >
              {kit.rules.map((r) => (
                <Row key={r.id} canEdit={canEdit} busy={busy === r.id} onEdit={() => setEditing({ kind: "rules", item: r })} onDelete={() => remove("rules", r.id)}>
                  <span className="num w-10 shrink-0 num text-[13px] text-ash-600">§{r.section}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{r.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{r.text}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <SeverityBadge s={r.severity} />
                      <Pill className="bg-white text-muted ring-line">{ISSUE[r.category]}</Pill>
                      {r.check && !isAiCheck(r.check) ? (
                        <Pill className="bg-ash-50 text-ash-700 ring-ash-200">
                          <Cpu className="size-3" /> {CHECK_LABEL[r.check.kind]}
                        </Pill>
                      ) : r.check ? (
                        <Pill className="bg-white text-ash-700 ring-ash-200">
                          <Sparkles className="size-3" /> {CHECK_LABEL[r.check.kind]}
                        </Pill>
                      ) : (
                        <Pill className="bg-white text-ash-700 ring-ash-200">
                          <Sparkles className="size-3" /> AI judgement
                        </Pill>
                      )}
                    </div>
                  </div>
                </Row>
              ))}
            </List>
          )}

          {tab === "terms" && (
            <List canEdit={canEdit} onAdd={() => setEditing({ kind: "terms", item: { banned: [] } })} addLabel="Add term">
              {kit.terms.map((t) => (
                <Row key={t.id} canEdit={canEdit} busy={busy === t.id} onEdit={() => setEditing({ kind: "terms", item: t })} onDelete={() => remove("terms", t.id)}>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold leading-snug text-ink">{t.preferred}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[13px]">
                      <span className="text-muted">Not:</span>
                      {t.banned.map((b) => (
                        <span key={b} className="rounded-md bg-red-50 px-1.5 py-0.5 text-red-700 line-through decoration-red/40">
                          {b}
                        </span>
                      ))}
                    </div>
                    {t.note && <p className="mt-1.5 text-sm text-muted">{t.note}</p>}
                  </div>
                </Row>
              ))}
            </List>
          )}

          {tab === "facts" && (
            <List canEdit={canEdit} onAdd={() => setEditing({ kind: "facts", item: { keywords: [] } })} addLabel="Add fact">
              {kit.facts.map((f) => {
                const d = f.expiresOn ? daysUntil(f.expiresOn, today) : null;
                return (
                  <Row key={f.id} canEdit={canEdit} busy={busy === f.id} onEdit={() => setEditing({ kind: "facts", item: f })} onDelete={() => remove("facts", f.id)}>
                    <span className="num w-10 shrink-0 num text-[13px] text-ash-600">{f.id}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium leading-snug text-ink">“{f.statement}”</p>
                      <p className="mt-1 text-sm text-muted">
                        {f.source} · owner: {f.owner}
                        {f.value != null && <span className="num"> · value {f.value.toLocaleString("en-IN")}</span>}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {d == null ? (
                          <Pill className="bg-white text-muted ring-line">No expiry</Pill>
                        ) : d < 0 ? (
                          <Pill className="bg-red-50 text-red-700 ring-red/25">Expired {f.expiresOn}</Pill>
                        ) : d <= 30 ? (
                          <Pill className="bg-amber-50 text-amber-700 ring-amber/25">Expires in {d} days</Pill>
                        ) : (
                          <Pill className="bg-green-50 text-green-700 ring-green/25">Valid to {f.expiresOn}</Pill>
                        )}
                        {f.keywords.map((k) => (
                          <span key={k} className="rounded-md bg-ash-50 px-1.5 py-0.5 text-[13px] text-ash-700">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Row>
                );
              })}
            </List>
          )}

          {tab === "voice" && <VoicePalette kit={kit} canEdit={canEdit} />}
          {tab === "import" && <Importer canEdit={canEdit} aiOn={aiOn} onDone={() => setTab("rules")} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {editing && <EditorModal editing={editing} busy={busy === "save"} onClose={() => setEditing(null)} onSave={(kind, item) => save(kind, item)} />}
      </AnimatePresence>
    </div>
  );
}

function Stat({ n, label, hot }: { n: number; label: string; hot?: boolean }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className={cx("num text-2xl font-semibold leading-none tracking-[-0.02em]", hot ? "text-red" : "text-ink")}>{n}</dd>
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  );
}

function List({ children, canEdit, onAdd, addLabel }: { children: React.ReactNode; canEdit: boolean; onAdd: () => void; addLabel: string }) {
  return (
    <Card className="divide-y divide-hair">
      {children}
      {canEdit && (
        <div className="p-3">
          <Button variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={onAdd}>
            {addLabel}
          </Button>
        </div>
      )}
    </Card>
  );
}

function Row({ children, canEdit, busy, onEdit, onDelete }: { children: React.ReactNode; canEdit: boolean; busy: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-start gap-3 px-4 py-3.5 sm:px-5">
      {children}
      {canEdit && (
        <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button onClick={onEdit} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ash-50 hover:text-ink" aria-label="Edit">
            <Pencil className="size-4" />
          </button>
          <button onClick={onDelete} disabled={busy} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700" aria-label="Delete">
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- editor modal ----------

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function EditorModal({
  editing,
  busy,
  onClose,
  onSave,
}: {
  editing: NonNullable<Editing>;
  busy: boolean;
  onClose: () => void;
  onSave: (kind: "rules" | "terms" | "facts", item: object) => void;
}) {
  const [v, setV] = useState<Record<string, unknown>>(() => {
    const i = editing.item as Record<string, unknown>;
    return {
      ...i,
      banned: Array.isArray(i.banned) ? (i.banned as string[]).join(", ") : "",
      keywords: Array.isArray(i.keywords) ? (i.keywords as string[]).join(", ") : "",
      checkKind: (i.check as RuleCheck | null)?.kind ?? "",
      pattern: (i.check as { pattern?: string } | null)?.pattern ?? "",
      fixText: (i.check as { fix?: string } | null)?.fix ?? "",
    };
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const s = (k: string) => (v[k] as string | undefined) ?? "";

  function build(): object {
    if (editing.kind === "terms") return { id: v.id, preferred: s("preferred"), banned: list(s("banned")), note: s("note") || null };
    if (editing.kind === "facts") {
      const num = s("value").toString().replace(/,/g, "");
      return {
        id: v.id,
        statement: s("statement"),
        keywords: list(s("keywords")),
        value: num ? Number(num) : null,
        source: s("source"),
        owner: s("owner"),
        expiresOn: s("expiresOn") || null,
      };
    }
    const kind = s("checkKind");
    const old = (editing.item as Partial<Rule>).check;
    const check =
      kind === "pattern"
        ? { kind, pattern: s("pattern"), flags: "gi", ...(s("fixText") ? { fix: s("fixText") } : {}) }
        : kind && old?.kind === kind
          ? old
          : kind === "maxSentenceWords"
            ? { kind, value: 25 }
            : kind === "contrast"
              ? { kind, min: 4.5 }
              : kind === "palette"
                ? { kind, maxDistance: 22 }
                : kind
                  ? { kind }
                  : null;
    return {
      id: v.id,
      section: s("section"),
      title: s("title"),
      text: s("text"),
      category: s("category") as IssueType,
      severity: s("severity") as Severity,
      check,
      badExample: s("badExample") || null,
      goodExample: s("goodExample") || null,
    };
  }

  const title = { rules: "rule", terms: "term", facts: "approved fact" }[editing.kind];

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-soot/50" onClick={onClose} />
      <motion.form
        role="dialog"
        aria-modal
        aria-label={`Edit ${title}`}
        onSubmit={(e) => {
          e.preventDefault();
          onSave(editing.kind, build());
        }}
        initial={{ y: 16, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 8, scale: 0.98, transition: { duration: 0.12 } }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="relative grid max-h-[90vh] w-full max-w-lg gap-4 overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-lift"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">
            {editing.item.id ? "Edit" : "New"} {title}
          </h2>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg hover:bg-ash-50" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {editing.kind === "rules" && (
          <>
            <div className="grid grid-cols-[90px_1fr] gap-3">
              <Field label="Section">
                <input required value={s("section")} onChange={set("section")} placeholder="2.4" className={inputCls} />
              </Field>
              <Field label="Title">
                <input required value={s("title")} onChange={set("title")} placeholder="Short and imperative" className={inputCls} />
              </Field>
            </div>
            <Field label="Rule text">
              <textarea required rows={2} value={s("text")} onChange={set("text")} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select value={s("category")} onChange={set("category")} className={inputCls}>
                  {Object.entries(ISSUE).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Severity">
                <select value={s("severity")} onChange={set("severity")} className={inputCls}>
                  <option value="blocker">Blocker</option>
                  <option value="warning">Warning</option>
                  <option value="suggestion">Suggestion</option>
                </select>
              </Field>
            </div>
            <Field label="How it's checked" hint="Code checks are exact. AI judgement is verified before anyone sees it.">
              <select value={s("checkKind")} onChange={set("checkKind")} className={inputCls}>
                <option value="">AI judgement (tone, messaging…)</option>
                <option value="pattern">Pattern (banned words or phrases)</option>
                <option value="maxSentenceWords">Sentence length (25 words)</option>
                <option value="superlative">Claims need approved facts</option>
                <option value="altText">Image alt text</option>
                <option value="contrast">WCAG contrast 4.5 : 1</option>
                <option value="palette">Brand palette match</option>
              </select>
            </Field>
            {s("checkKind") === "pattern" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pattern (regex)">
                  <input required value={s("pattern")} onChange={set("pattern")} placeholder="\b(hurry|last chance)\b" className={cx(inputCls, "num text-[13px]")} />
                </Field>
                <Field label="Replacement (optional)">
                  <input value={s("fixText")} onChange={set("fixText")} className={inputCls} />
                </Field>
              </div>
            )}
            {!s("checkKind") && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bad example">
                  <input value={s("badExample")} onChange={set("badExample")} className={inputCls} />
                </Field>
                <Field label="Good example">
                  <input value={s("goodExample")} onChange={set("goodExample")} className={inputCls} />
                </Field>
              </div>
            )}
          </>
        )}

        {editing.kind === "terms" && (
          <>
            <Field label="Preferred form">
              <input required value={s("preferred")} onChange={set("preferred")} className={inputCls} />
            </Field>
            <Field label="Banned variants" hint="Comma-separated. Matched as whole words, any case.">
              <input required value={s("banned")} onChange={set("banned")} className={inputCls} />
            </Field>
            <Field label="Note for writers">
              <input value={s("note")} onChange={set("note")} className={inputCls} />
            </Field>
          </>
        )}

        {editing.kind === "facts" && (
          <>
            <Field label="Approved wording" hint="Used as the suggested fix when a claim is unsupported.">
              <input required value={s("statement")} onChange={set("statement")} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Topic keywords" hint="Comma-separated, e.g. customers">
                <input required value={s("keywords")} onChange={set("keywords")} className={inputCls} />
              </Field>
              <Field label="Number (optional)" hint="e.g. 310000 for 3.1 lakh">
                <input inputMode="decimal" value={s("value")} onChange={set("value")} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Source">
                <input required value={s("source")} onChange={set("source")} className={inputCls} />
              </Field>
              <Field label="Owner">
                <input required value={s("owner")} onChange={set("owner")} className={inputCls} />
              </Field>
            </div>
            <Field label="Expires on" hint="After this date, claims using it are flagged as outdated.">
              <input type="date" value={s("expiresOn")} onChange={set("expiresOn")} className={inputCls} />
            </Field>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save
          </Button>
        </div>
      </motion.form>
    </motion.div>
  );
}

// ---------- voice & palette ----------

function VoicePalette({ kit, canEdit }: { kit: BrandKit; canEdit: boolean }) {
  const router = useRouter();
  const [voice, setVoice] = useState(kit.voice);
  const [palette, setPalette] = useState(kit.palette);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = voice !== kit.voice || JSON.stringify(palette) !== JSON.stringify(kit.palette);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/kit", { method: "PATCH", body: { voice, palette } });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="grid gap-3 p-5">
        <p className="kicker">Brand voice</p>
        <textarea
          rows={6}
          value={voice}
          disabled={!canEdit}
          onChange={(e) => setVoice(e.target.value)}
          className={cx(inputCls, "text-base leading-relaxed disabled:bg-ash-25")}
        />
        <p className="text-[13px] text-muted">The AI judgement pass reads this, so tone is judged against your voice, not some generic idea of “correct” English.</p>
      </Card>
      <Card className="grid gap-3 p-5">
        <p className="kicker">Palette · used by image checks</p>
        <ul className="grid gap-2">
          {palette.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                type="color"
                value={p.hex}
                disabled={!canEdit}
                onChange={(e) => setPalette(palette.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)))}
                className="size-10 cursor-pointer rounded-lg border border-line bg-white p-1"
                aria-label={`${p.name} colour`}
              />
              <input value={p.name} disabled={!canEdit} onChange={(e) => setPalette(palette.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={cx(inputCls, "flex-1")} />
              <span className="num w-20 num text-[13px] text-muted">{p.hex}</span>
              {canEdit && (
                <button onClick={() => setPalette(palette.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-700" aria-label={`Remove ${p.name}`}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <Button size="sm" variant="ghost" className="w-fit" icon={<Plus className="size-4" />} onClick={() => setPalette([...palette, { name: "New colour", hex: "#2569A8" }])}>
            Add colour
          </Button>
        )}
      </Card>
      {canEdit && (
        <div className="flex items-center gap-3 lg:col-span-2">
          <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>
            {saved ? "Saved" : "Save voice & palette"}
          </Button>
          <ErrorNote error={error} />
        </div>
      )}
    </div>
  );
}

// ---------- import ----------

interface Proposal {
  voice: string | null;
  rules: Rule[];
  terms: Term[];
  facts: Fact[];
  provider: string;
}

function Importer({ canEdit, aiOn, onDone }: { canEdit: boolean; aiOn: boolean; onDone: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy("parse");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ text: string }>("/api/parse", { form });
      setText(res.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function analyse() {
    setBusy("analyse");
    setError(null);
    setProposal(null);
    try {
      setProposal(await api<Proposal>("/api/kit/import", { body: { text } }));
      setSkip(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function apply() {
    if (!proposal) return;
    setBusy("apply");
    setError(null);
    try {
      const items = [
        ...proposal.rules.map((item) => ({ kind: "rules", item })),
        ...proposal.terms.map((item) => ({ kind: "terms", item })),
        ...proposal.facts.map((item) => ({ kind: "facts", item })),
      ].filter((x) => !skip.has(x.item.id));
      for (const x of items) await api("/api/kit", { body: x });
      if (proposal.voice && !skip.has("voice")) await api("/api/kit", { method: "PATCH", body: { voice: proposal.voice } });
      router.refresh();
      setProposal(null);
      setText("");
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const toggle = (id: string) => setSkip((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const total = proposal ? proposal.rules.length + proposal.terms.length + proposal.facts.length + (proposal.voice ? 1 : 0) : 0;

  if (!canEdit) {
    return (
      <Card className="flex items-center gap-3 p-5 text-sm text-ink">
        <Lock className="size-4 text-ash-600" /> Only admins can import guidelines.
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-hair px-4 py-2.5">
          <p className="kicker">Your guideline document</p>
          <Button size="sm" variant="ghost" className="ml-auto" loading={busy === "parse"} icon={<FileUp className="size-3.5" />} onClick={() => fileRef.current?.click()}>
            Upload .pdf / .docx / .md
          </Button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.md,.markdown,.txt" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        <textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your brand guidelines here, or upload the PDF your design agency gave you."
          className="block w-full resize-y px-5 py-4 text-sm leading-relaxed text-ink outline-none placeholder:text-muted/60"
        />
        <div className="flex flex-wrap items-center gap-3 border-t border-hair bg-ash-50/50 px-4 py-3">
          <p className="text-[13px] text-muted">
            {aiOn ? "AI proposes rules, terms and facts. Nothing is added until you pick what to keep." : "Needs an AI key (GEMINI_API_KEY) on the server. You can still add rules by hand."}
          </p>
          <Button className="ml-auto" variant="primary" size="sm" loading={busy === "analyse"} disabled={!aiOn || text.trim().length < 40} icon={<Wand2 className="size-3.5" />} onClick={analyse}>
            Extract Brand Kit
          </Button>
        </div>
      </Card>

      <AnimatePresence>{error && <ErrorNote error={error} />}</AnimatePresence>

      {busy === "analyse" && (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {proposal && (
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-ink">Proposed additions</p>
            <span className="text-[13px] text-muted">via {proposal.provider}. Untick anything you don&apos;t want.</span>
          </div>
          {proposal.voice && <Proposed id="voice" skip={skip} toggle={toggle} title="Voice" body={proposal.voice} />}
          {proposal.rules.map((r) => (
            <Proposed key={r.id} id={r.id} skip={skip} toggle={toggle} title={`§${r.section} ${r.title}`} body={r.text} tag={`${r.severity} · ${r.check && !isAiCheck(r.check) ? "pattern" : "AI judgement"}`} />
          ))}
          {proposal.terms.map((t) => (
            <Proposed key={t.id} id={t.id} skip={skip} toggle={toggle} title={t.preferred} body={`Not: ${t.banned.join(", ")}`} tag="term" />
          ))}
          {proposal.facts.map((f) => (
            <Proposed key={f.id} id={f.id} skip={skip} toggle={toggle} title={f.statement} body={`${f.source} · ${f.owner}${f.expiresOn ? ` · expires ${f.expiresOn}` : ""}`} tag="fact" />
          ))}
          <div className="flex justify-end">
            <Button variant="primary" loading={busy === "apply"} onClick={apply} disabled={total - skip.size <= 0}>
              Add {total - skip.size} item{total - skip.size === 1 ? "" : "s"} to the kit
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Proposed({ id, skip, toggle, title, body, tag }: { id: string; skip: Set<string>; toggle: (id: string) => void; title: string; body: string; tag?: string }) {
  const on = !skip.has(id);
  return (
    <label className={cx("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors", on ? "border-ash-300 bg-ash-50/50" : "border-line opacity-60")}>
      <input type="checkbox" checked={on} onChange={() => toggle(id)} className="mt-1 size-4 accent-[var(--color-ash-600)]" />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
          {title} {tag && <span className="num text-[13px] text-ash-600">{tag}</span>}
        </span>
        <span className="block text-sm text-muted">{body}</span>
      </span>
    </label>
  );
}
