// Domain repository: everything the API and pages need, on top of the store.

import "server-only";
import { runReview } from "../engine";
import { score } from "../engine/verify";
import { uid } from "../engine/text";
import type {
  AuditEntry,
  BrandKit,
  Fact,
  FindingRow,
  FindingStatus,
  ImageInput,
  ReviewResult,
  Revision,
  Role,
  Rule,
  Submission,
  SubmissionStatus,
  Term,
} from "../types";
import { DIWALI_IMAGE } from "./demo-image-data";
import { DEMO_KIT, DEMO_SUBMISSIONS, VISION_RULES } from "./seed";
import { store, type Row } from "./store";

const KIT_ID = DEMO_KIT.id;
const now = () => new Date().toISOString();

type KitRow = { id: string; name: string; voice: string; palette: BrandKit["palette"]; imageRulesAdded?: boolean };
type FindingDbRow = FindingRow & { ruleId: string | null; termId: string | null; factId: string | null; createdAt: string };

function toDbFinding(f: FindingRow, createdAt: string): FindingDbRow {
  return {
    ...f,
    ruleId: f.cites.kind === "rule" ? f.cites.id : null,
    termId: f.cites.kind === "term" ? f.cites.id : null,
    factId: f.cites.kind === "fact" ? f.cites.id : null,
    createdAt,
  };
}

// ---------- seeding ----------

// On globalThis for the same reason as the file store: one seed per server process, not one per bundle.
const SEEDING = Symbol.for("plumbline.seeding");
const seedSlot = globalThis as unknown as Record<symbol, Promise<void> | null | undefined>;

export function ensureSeeded(): Promise<void> {
  seedSlot[SEEDING] ??= (async () => {
    const s = store();
    const kits = await s.list<KitRow>("kits");
    if (kits.length) return addImageRules(kits[0]);
    const { rules, terms, facts, ...meta } = DEMO_KIT;
    await s.insert("kits", [{ ...meta, imageRulesAdded: true } as unknown as Row]);
    await s.insert("rules", rules.map((r) => ({ ...r, kitId: KIT_ID }) as unknown as Row));
    await s.insert("terms", terms.map((t) => ({ ...t, kitId: KIT_ID }) as unknown as Row));
    await s.insert("facts", facts.map((f) => ({ ...f, kitId: KIT_ID }) as unknown as Row));

    for (const demo of DEMO_SUBMISSIONS) {
      const at = new Date(Date.now() - demo.daysAgo * 86400000 - 3600000).toISOString();
      const result = asSample(await runReview({ text: demo.text, kit: DEMO_KIT, image: demo.image, keyMessage: demo.keyMessage, channel: demo.channel }));
      const sub = await insertSubmission(
        { title: demo.title, channel: demo.channel, aiAssisted: demo.aiAssisted, keyMessage: demo.keyMessage, text: demo.text, image: demo.image ?? null },
        result,
        "creator",
        at
      );
      for (const d of demo.decisions ?? []) {
        const rows = await s.list<FindingDbRow>("findings", { submissionId: sub.id });
        for (const f of rows.filter((x) => x.cites.id === d.cite)) {
          await s.update("findings", f.id, { status: d.status, decidedBy: "approver", reason: d.reason ?? null });
          await audit(sub.id, "approver", `finding.${d.status}`, `${f.cites.label}: “${f.quote}”. ${d.reason ?? ""}`.trim(), at);
        }
      }
      if (demo.status !== "draft") {
        await s.update("submissions", sub.id, { status: demo.status, updatedAt: at });
        await audit(sub.id, demo.status === "in_review" ? "creator" : "approver", `status.${demo.status}`, statusLabel(demo.status), at);
      }
    }
  })().catch((e) => {
    seedSlot[SEEDING] = null;
    throw e;
  });
  return seedSlot[SEEDING];
}

const SAMPLE_NOTE = "This sample was saved without AI. Run the AI check to try it.";

/** Seeded drafts are checked by code at start-up, so say that instead of implying AI is off. */
function asSample(result: ReviewResult): ReviewResult {
  return { ...result, ai: { ...result.ai, note: SAMPLE_NOTE, calls: result.ai.calls.map((c) => ({ ...c, returned: SAMPLE_NOTE })) } };
}

/** Stores created before image rules existed get them once, so an admin can still delete them later. */
async function addImageRules(kit: KitRow) {
  if (kit.imageRulesAdded) return;
  const s = store();
  const have = new Set((await s.list<Rule>("rules", { kitId: KIT_ID })).map((r) => r.id));
  await s.insert("rules", VISION_RULES.filter((r) => !have.has(r.id)).map((r) => ({ ...r, kitId: KIT_ID }) as unknown as Row));
  for (const rev of await s.list<Revision>("revisions")) {
    if (rev.image?.name === "diwali-banner.png" && !rev.image.thumbnail) await s.update("revisions", rev.id, { image: DIWALI_IMAGE });
  }
  await s.update("kits", kit.id, { imageRulesAdded: true });
}

// ---------- brand kit ----------

const sectionKey = (s: string) => s.split(".").map((n) => n.padStart(3, "0")).join(".");

export async function getKit(): Promise<BrandKit> {
  await ensureSeeded();
  const s = store();
  const [meta] = await s.list<KitRow>("kits", { id: KIT_ID });
  const strip = <T>(rows: (T & { kitId?: string })[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "kitId")) as T);
  const rules = strip(await s.list<Rule & { kitId: string }>("rules", { kitId: KIT_ID })).sort((a, b) =>
    sectionKey(a.section).localeCompare(sectionKey(b.section))
  );
  const terms = strip(await s.list<Term & { kitId: string }>("terms", { kitId: KIT_ID })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const facts = strip(await s.list<Fact & { kitId: string }>("facts", { kitId: KIT_ID })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return { ...(meta ?? DEMO_KIT), rules, terms, facts };
}

export async function updateKitMeta(patch: Partial<Pick<BrandKit, "name" | "voice" | "palette">>, role: Role) {
  await ensureSeeded();
  await store().update("kits", KIT_ID, patch);
  await audit(null, role, "kit.updated", Object.keys(patch).join(", "));
}

export type KitItemKind = "rules" | "terms" | "facts";

export async function upsertKitItem(kind: KitItemKind, item: Rule | Term | Fact, role: Role) {
  await ensureSeeded();
  const s = store();
  const existing = await s.get(kind, item.id);
  if (existing) await s.update(kind, item.id, { ...item });
  else await s.insert(kind, [{ ...item, kitId: KIT_ID } as unknown as Row]);
  await audit(null, role, `kit.${kind}.${existing ? "updated" : "added"}`, item.id);
}

export async function deleteKitItem(kind: KitItemKind, id: string, role: Role) {
  await ensureSeeded();
  await store().remove(kind, id);
  await audit(null, role, `kit.${kind}.deleted`, id);
}

export async function nextId(kind: KitItemKind): Promise<string> {
  const kit = await getKit();
  const prefix = kind === "terms" ? "T-" : kind === "facts" ? "F" : "R-";
  const list = kind === "terms" ? kit.terms : kind === "facts" ? kit.facts : kit.rules;
  const nums = list.map((x) => parseInt(x.id.replace(/\D+/g, ""), 10)).filter((n) => !Number.isNaN(n));
  return kind === "rules" ? `R-${uid("x").slice(-5)}` : `${prefix}${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

// ---------- submissions ----------

export interface NewSubmission {
  title: string;
  channel: string;
  aiAssisted: boolean;
  keyMessage: string | null;
  text: string;
  image: ImageInput | null;
}

async function insertSubmission(input: NewSubmission, result: ReviewResult, role: Role, at = now()): Promise<Submission> {
  const s = store();
  const sub: Submission = {
    id: uid("s"),
    title: input.title,
    channel: input.channel,
    aiAssisted: input.aiAssisted,
    keyMessage: input.keyMessage,
    status: "draft",
    createdAt: at,
    updatedAt: at,
  };
  await s.insert("submissions", [sub as unknown as Row]);
  await insertRevision(sub.id, 1, input.text, input.image, result, at);
  await audit(sub.id, role, "submission.created", `v1 checked · score ${result.score} · ${result.findings.length} finding(s)`, at);
  await auditAi(sub.id, role, result, at);
  return sub;
}

async function insertRevision(submissionId: string, n: number, text: string, image: ImageInput | null, result: ReviewResult, at = now()) {
  const s = store();
  const rev: Revision = {
    id: uid("v"),
    submissionId,
    n,
    text,
    image,
    imageReport: result.imageReport,
    score: result.score,
    ai: result.ai,
    claims: result.claims,
    dropped: result.dropped,
    createdAt: at,
  };
  await s.insert("revisions", [rev as unknown as Row]);
  await s.insert(
    "findings",
    result.findings.map((f) => toDbFinding({ ...f, revisionId: rev.id, submissionId }, at) as unknown as Row)
  );
  return rev;
}

export async function createSubmission(input: NewSubmission, result: ReviewResult, role: Role) {
  await ensureSeeded();
  return insertSubmission(input, result, role);
}

export async function addRevision(id: string, text: string, image: ImageInput | null, result: ReviewResult, role: Role) {
  const s = store();
  const revs = await s.list<Revision>("revisions", { submissionId: id });
  const n = Math.max(0, ...revs.map((r) => r.n)) + 1;
  const rev = await insertRevision(id, n, text, image, result);
  await s.update("submissions", id, { updatedAt: now(), status: "draft" });
  await audit(id, role, "revision.created", `v${n} checked · score ${result.score} · ${result.findings.length} finding(s)`);
  await auditAi(id, role, result);
  return rev;
}

export interface SubmissionSummary extends Submission {
  version: number;
  score: number;
  blockers: number;
  warnings: number;
  suggestions: number;
  routed: number;
  excerpt: string;
}

export async function listSubmissions(): Promise<SubmissionSummary[]> {
  await ensureSeeded();
  const s = store();
  const [subs, revs, finds] = await Promise.all([
    s.list<Submission>("submissions"),
    s.list<Revision>("revisions"),
    s.list<FindingDbRow>("findings"),
  ]);
  return subs
    .map((sub) => {
      const latest = revs.filter((r) => r.submissionId === sub.id).sort((a, b) => b.n - a.n)[0];
      const open = finds.filter((f) => f.revisionId === latest?.id && (f.status === "open" || f.status === "disputed"));
      return {
        ...sub,
        version: latest?.n ?? 0,
        score: latest ? score(finds.filter((f) => f.revisionId === latest.id)) : 0,
        blockers: open.filter((f) => f.severity === "blocker").length,
        warnings: open.filter((f) => f.severity === "warning").length,
        suggestions: open.filter((f) => f.severity === "suggestion").length,
        routed: open.filter((f) => f.needsReview).length,
        excerpt: (latest?.text ?? "").slice(0, 140),
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface SubmissionDetail {
  submission: Submission;
  revisions: Revision[];
  findings: FindingRow[];
  audit: AuditEntry[];
}

export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  await ensureSeeded();
  const s = store();
  const submission = await s.get<Submission>("submissions", id);
  if (!submission) return null;
  const revisions = (await s.list<Revision>("revisions", { submissionId: id })).sort((a, b) => a.n - b.n);
  const latest = revisions[revisions.length - 1];
  const findings = latest ? await s.list<FindingDbRow>("findings", { revisionId: latest.id }) : [];
  const order = { blocker: 0, warning: 1, suggestion: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.start - b.start);
  const log = (await s.list<AuditEntry>("audit", { submissionId: id })).sort((a, b) => b.at.localeCompare(a.at));
  return { submission, revisions, findings, audit: log };
}

export async function getFinding(id: string) {
  return store().get<FindingDbRow>("findings", id);
}

export async function updateFinding(id: string, status: FindingStatus, role: Role, reason: string | null) {
  const s = store();
  const f = await s.get<FindingDbRow>("findings", id);
  if (!f) return null;
  await s.update("findings", id, { status, decidedBy: role, reason });
  await s.update("submissions", f.submissionId, { updatedAt: now() });
  await audit(f.submissionId, role, `finding.${status}`, `${f.cites.label}: “${f.quote.slice(0, 80)}”${reason ? `. ${reason}` : ""}`);
  const rows = await s.list<FindingDbRow>("findings", { revisionId: f.revisionId });
  const newScore = score(rows);
  await s.update("revisions", f.revisionId, { score: newScore });
  return { ...f, status, decidedBy: role, reason, score: newScore };
}

export function statusLabel(s: SubmissionStatus): string {
  return { draft: "Draft", in_review: "Sent for approval", changes_requested: "Changes requested", approved: "Approved for publishing" }[s];
}

export async function setStatus(id: string, status: SubmissionStatus, role: Role, note: string | null) {
  const s = store();
  await s.update("submissions", id, { status, updatedAt: now() });
  await audit(id, role, `status.${status}`, statusLabel(status) + (note ? `. ${note}` : ""));
}

// ---------- audit ----------

/** Every real AI call goes in the audit log, including the ones that failed. */
async function auditAi(submissionId: string, role: Role, result: ReviewResult, at = now()) {
  for (const c of result.ai.calls.filter((x) => x.status !== "skipped")) {
    const what = c.pass === "image" ? "AI image check" : "AI tone check";
    await audit(submissionId, role, `ai.${c.pass}`, `${what} ${c.status === "ran" ? `ran on ${c.model}` : "failed"} in ${(c.ms / 1000).toFixed(1)} s: ${c.returned}`, at);
  }
}

export async function audit(submissionId: string | null, role: Role, action: string, detail: string, at = now()) {
  const entry: AuditEntry = { id: uid("a"), submissionId, role, action, detail, at };
  await store().insert("audit", [entry as unknown as Row]);
}

export async function listAudit(limit = 200): Promise<(AuditEntry & { title: string | null })[]> {
  await ensureSeeded();
  const s = store();
  const [entries, subs] = await Promise.all([s.list<AuditEntry>("audit"), s.list<Submission>("submissions")]);
  const titles = new Map(subs.map((x) => [x.id, x.title]));
  return entries
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((e) => ({ ...e, title: e.submissionId ? titles.get(e.submissionId) ?? null : null }));
}

// ---------- insights ----------

export interface Insights {
  totals: { submissions: number; reviews: number; findings: number; openBlockers: number; approved: number; avgScore: number };
  byType: { type: string; count: number }[];
  byRule: { id: string; label: string; title: string; count: number; overridden: number; accepted: number; decided: number }[];
  gaps: { id: string; label: string; title: string; text: string; decided: number; overridden: number; rate: number; reasons: string[] }[];
  aiVsHuman: { group: string; drafts: number; avgFindings: number; claimIssues: number }[];
  byChannel: { channel: string; count: number }[];
  scores: { title: string; first: number; latest: number; versions: number }[];
}

export async function insights(): Promise<Insights> {
  const kit = await getKit();
  const s = store();
  const [subs, revs, finds] = await Promise.all([
    s.list<Submission>("submissions"),
    s.list<Revision>("revisions"),
    s.list<FindingDbRow>("findings"),
  ]);
  const latestOf = (id: string) => revs.filter((r) => r.submissionId === id).sort((a, b) => b.n - a.n)[0];
  const firstOf = (id: string) => revs.filter((r) => r.submissionId === id).sort((a, b) => a.n - b.n)[0];

  const byTypeMap = new Map<string, number>();
  for (const f of finds) byTypeMap.set(f.type, (byTypeMap.get(f.type) ?? 0) + 1);

  const label = new Map<string, { label: string; title: string; text: string }>();
  for (const r of kit.rules) label.set(r.id, { label: `Rule ${r.section}`, title: r.title, text: r.text });
  for (const t of kit.terms) label.set(t.id, { label: `Term`, title: t.preferred, text: `Not: ${t.banned.join(", ")}` });
  for (const f of kit.facts) label.set(f.id, { label: `Fact ${f.id}`, title: f.statement, text: f.source });

  const ruleStats = new Map<string, { count: number; overridden: number; accepted: number; decided: number; reasons: string[] }>();
  for (const f of finds) {
    const st = ruleStats.get(f.cites.id) ?? { count: 0, overridden: 0, accepted: 0, decided: 0, reasons: [] };
    st.count++;
    if (f.status !== "open") st.decided++;
    if (f.status === "dismissed" || f.status === "overridden") {
      st.overridden++;
      if (f.reason) st.reasons.push(f.reason);
    }
    if (f.status === "accepted" || f.status === "cleared") st.accepted++;
    ruleStats.set(f.cites.id, st);
  }
  const byRule = [...ruleStats.entries()]
    .map(([id, st]) => ({ id, ...(label.get(id) ?? { label: id, title: id, text: "" }), ...st }))
    .sort((a, b) => b.count - a.count);

  const GAP_MIN_DECISIONS = 3;
  const GAP_RATE = 0.5;
  const gaps = byRule
    .filter((r) => r.decided >= GAP_MIN_DECISIONS && r.overridden / r.decided >= GAP_RATE)
    .map((r) => ({ id: r.id, label: r.label, title: r.title, text: r.text, decided: r.decided, overridden: r.overridden, rate: r.overridden / r.decided, reasons: r.reasons.slice(0, 4) }));

  const group = (ai: boolean) => {
    const list = subs.filter((x) => x.aiAssisted === ai);
    const firsts = list.map((x) => firstOf(x.id)).filter(Boolean);
    const fs = finds.filter((f) => firsts.some((r) => r.id === f.revisionId));
    return {
      group: ai ? "AI-assisted drafts" : "Human-written drafts",
      drafts: list.length,
      avgFindings: list.length ? Math.round((fs.length / list.length) * 10) / 10 : 0,
      claimIssues: fs.filter((f) => f.type === "claim").length,
    };
  };

  const channelMap = new Map<string, number>();
  for (const x of subs) channelMap.set(x.channel, (channelMap.get(x.channel) ?? 0) + 1);

  const latestIds = new Set(subs.map((x) => latestOf(x.id)?.id).filter(Boolean));
  const latestFindings = finds.filter((f) => latestIds.has(f.revisionId));
  const scores = subs.map((x) => {
    const versions = revs.filter((r) => r.submissionId === x.id).sort((a, b) => a.n - b.n);
    return {
      title: x.title,
      first: versions[0]?.score ?? 0,
      latest: score(finds.filter((f) => f.revisionId === versions[versions.length - 1]?.id)),
      versions: versions.length,
    };
  });

  return {
    totals: {
      submissions: subs.length,
      reviews: revs.length,
      findings: finds.length,
      openBlockers: latestFindings.filter((f) => f.severity === "blocker" && (f.status === "open" || f.status === "disputed")).length,
      approved: subs.filter((x) => x.status === "approved").length,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b.latest, 0) / scores.length) : 0,
    },
    byType: [...byTypeMap.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    byRule,
    gaps,
    aiVsHuman: [group(true), group(false)],
    byChannel: [...channelMap.entries()].map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count),
    scores,
  };
}
