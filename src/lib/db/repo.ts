// Domain repository: everything the API and pages need, on top of the store.
// Every read and write is scoped to one organisation (kit). The kit id comes from the signed session.

import "server-only";
import { ORGS } from "../auth-shared";
import { plural } from "../audit-labels";
import { runReview } from "../engine";
import { applyCalibration, calibrate, PIN_DAYS, replay, type CalibrationPin, type LedgerDecision, type ReplaySummary, type RuleCalibration } from "../engine/calibrate";
import { simulatedHistory, simulatedTimeline } from "../engine/calibrate-demo";
import { carryDecisions, fingerprint, hash, implicitlyAccepted } from "../engine/fingerprint";
import { score } from "../engine/verify";
import { uid } from "../engine/text";
import type {
  AuditEntry,
  BrandKit,
  CiteKind,
  Fact,
  FindingRow,
  FindingStatus,
  ImageInput,
  ReasonCode,
  ReviewResult,
  Revision,
  Role,
  Rule,
  Submission,
  SubmissionStatus,
  Term,
} from "../types";
import { DIWALI_IMAGE } from "./demo-image-data";
import { DEMO_KIT, DEMO_SUBMISSIONS, VISION_RULES, type SeedSubmission } from "./seed";
import { HARBOUR_KIT, HARBOUR_SUBMISSIONS } from "./seed-harbour";
import type { LlmProvider } from "../ai/gemini";
import { ConflictError, store, type Row, type TableName } from "./store";

const now = () => new Date().toISOString();

const SEED_ORGS: { kit: BrandKit; drafts: SeedSubmission[] }[] = [
  { kit: DEMO_KIT, drafts: DEMO_SUBMISSIONS },
  { kit: HARBOUR_KIT, drafts: HARBOUR_SUBMISSIONS },
];

type KitRow = { id: string; name: string; voice: string; palette: BrandKit["palette"]; logos?: BrandKit["logos"]; imageRulesAdded?: boolean };
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

// ---------- rule versions ----------

const VERSION_FIELDS: Record<CiteKind, string[]> = {
  rule: ["text", "check", "severity"],
  term: ["preferred", "banned"],
  fact: ["statement", "value", "expiresOn", "keywords"],
};
const ITEM_TABLE: Record<CiteKind, TableName> = { rule: "rules", term: "terms", fact: "facts" };

/** Changes when the rule's meaning changes, so old decisions stop counting for the new rule. */
function itemHash(kind: CiteKind, item: object | null | undefined): string {
  if (!item) return "unknown";
  const fields = item as Record<string, unknown>;
  return hash(VERSION_FIELDS[kind].map((k) => fields[k] ?? null));
}

function kitItem(kit: BrandKit, kind: CiteKind, id: string): object | undefined {
  const list: { id: string }[] = kind === "rule" ? kit.rules : kind === "term" ? kit.terms : kit.facts;
  return list.find((x) => x.id === id);
}

const mediaKey = (image: ImageInput | null) => (image ? hash(image.thumbnail ?? image.name) : "none");

// ---------- learning ----------

const DEMO_QUIET_RULE = "R-3.4";

/** Real decisions, plus a clearly labelled simulated history for the demo brand only. */
async function teamHistory(kit: BrandKit): Promise<{ real: LedgerDecision[]; all: LedgerDecision[]; simulated: LedgerDecision[]; pins: CalibrationPin[] }> {
  const s = store();
  const [real, pins] = await Promise.all([s.list<LedgerDecision>("finding_decisions", { kitId: kit.id }), s.list<CalibrationPin>("calibration_pins", { kitId: kit.id })]);
  const demoRule = kit.id === DEMO_KIT.id ? DEMO_KIT.rules.find((r) => r.id === DEMO_QUIET_RULE) : undefined;
  const simulated = demoRule ? simulatedHistory(demoRule.id, itemHash("rule", demoRule), new Date()) : [];
  return { real: real.filter((d) => !d.isSeed), all: [...simulated, ...real], simulated, pins };
}

function learnedRules(kit: BrandKit, all: LedgerDecision[], pins: CalibrationPin[]): Map<string, RuleCalibration> {
  const kindOf = (id: string): CiteKind => (kit.terms.some((t) => t.id === id) ? "term" : kit.facts.some((f) => f.id === id) ? "fact" : "rule");
  return calibrate(all, pins, new Date(), (d) => itemHash(kindOf(d.ruleKey), kitItem(kit, kindOf(d.ruleKey), d.ruleKey)));
}

// ---------- seeding ----------

// On globalThis for the same reason as the file store: one seed per server process, not one per bundle.
const SEEDING = Symbol.for("plumbline.seeding");
const seedSlot = globalThis as unknown as Record<symbol, Promise<void> | null | undefined>;

/** Only the local file store seeds itself. A real database is seeded once by `npm run seed`. */
export function ensureSeeded(): Promise<void> {
  if (store().kind !== "file") return Promise.resolve();
  seedSlot[SEEDING] ??= seedDemo().catch((e) => {
    seedSlot[SEEDING] = null;
    throw e;
  });
  return seedSlot[SEEDING];
}

export async function seedDemo(provider: LlmProvider | null = null): Promise<void> {
  const kits = await store().list<KitRow>("kits");
  for (const { kit, drafts } of SEED_ORGS) {
    const existing = kits.find((k) => k.id === kit.id);
    if (existing) await addImageRules(existing);
    else await seedOrganisation(kit, drafts, provider);
  }
}

/** Clears the demo and seeds it again. Only the reset script calls this. */
export async function resetDemo(provider: LlmProvider | null = null): Promise<void> {
  await store().reset();
  seedSlot[SEEDING] = null;
  await seedDemo(provider);
}

async function seedOrganisation(kit: BrandKit, drafts: SeedSubmission[], provider: LlmProvider | null) {
  const s = store();
  const { rules, terms, facts, ...meta } = kit;
  await s.insert("kits", [{ ...meta, imageRulesAdded: true } as unknown as Row]);
  await s.insert("rules", rules.map((r) => ({ ...r, kitId: kit.id }) as unknown as Row));
  await s.insert("terms", terms.map((t) => ({ ...t, kitId: kit.id }) as unknown as Row));
  await s.insert("facts", facts.map((f) => ({ ...f, kitId: kit.id }) as unknown as Row));

  for (const demo of drafts) {
    const at = new Date(Date.now() - demo.daysAgo * 86400000 - 3600000).toISOString();
    const result = asSample(await runReview({ text: demo.text, kit, image: demo.image, keyMessage: demo.keyMessage, channel: demo.channel, provider }));
    const sub = await insertSubmission(
      kit,
      { title: demo.title, channel: demo.channel, aiAssisted: demo.aiAssisted, keyMessage: demo.keyMessage, text: demo.text, image: demo.image ?? null },
      result,
      "creator",
      at
    );
    for (const d of demo.decisions ?? []) {
      const rows = await s.list<FindingDbRow>("findings", { submissionId: sub.id });
      for (const f of rows.filter((x) => x.cites.id === d.cite)) {
        await applyDecision(kit.id, f, { status: d.status, role: "approver", reason: d.reason ?? null, reasonCode: d.reasonCode ?? null, isSeed: true, at });
      }
    }
    await s.update("submissions", sub.id, { status: demo.status, updatedAt: at });
    if (demo.status !== "draft") {
      await audit(kit.id, sub.id, demo.status === "in_review" ? "creator" : "approver", `status.${demo.status}`, statusLabel(demo.status), at);
    }
  }
}

const SAMPLE_NOTE = "This sample was saved without AI. Run the AI check to try it.";

/** A seeded draft that never reached the AI says so, instead of implying AI is off. */
function asSample(result: ReviewResult): ReviewResult {
  if (result.ai.calls.some((c) => c.status === "ran")) return result;
  return { ...result, ai: { ...result.ai, note: SAMPLE_NOTE, calls: result.ai.calls.map((c) => ({ ...c, returned: SAMPLE_NOTE })) } };
}

/** Stores created before image rules existed get them once, so an admin can still delete them later. */
async function addImageRules(kit: KitRow) {
  if (kit.imageRulesAdded || kit.id !== DEMO_KIT.id) return;
  const s = store();
  const have = new Set((await s.list<Rule>("rules", { kitId: kit.id })).map((r) => r.id));
  await s.insert("rules", VISION_RULES.filter((r) => !have.has(r.id)).map((r) => ({ ...r, kitId: kit.id }) as unknown as Row));
  for (const rev of await s.list<Revision>("revisions")) {
    if (rev.image?.name === "diwali-banner.png" && !rev.image.thumbnail) await s.update("revisions", rev.id, { image: DIWALI_IMAGE });
  }
  await s.update("kits", kit.id, { imageRulesAdded: true });
}

// ---------- brand kit ----------

const sectionKey = (s: string) => s.split(".").map((n) => n.padStart(3, "0")).join(".");
const seededKit = (kitId: string) => SEED_ORGS.find((o) => o.kit.id === kitId)?.kit ?? DEMO_KIT;

export async function getKit(kitId: string): Promise<BrandKit> {
  await ensureSeeded();
  const s = store();
  if (s.kind === "none") return seededKit(kitId); // public checks keep working with nothing to save to
  const [meta] = await s.list<KitRow>("kits", { id: kitId });
  const strip = <T>(rows: (T & { kitId?: string })[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "kitId")) as T);
  const rules = strip(await s.list<Rule & { kitId: string }>("rules", { kitId })).sort((a, b) =>
    sectionKey(a.section).localeCompare(sectionKey(b.section))
  );
  const terms = strip(await s.list<Term & { kitId: string }>("terms", { kitId })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const facts = strip(await s.list<Fact & { kitId: string }>("facts", { kitId })).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return { ...(meta ?? seededKit(kitId)), rules, terms, facts };
}

export async function updateKitMeta(kitId: string, patch: Partial<Pick<BrandKit, "name" | "voice" | "palette">>, role: Role) {
  await ensureSeeded();
  await store().update("kits", kitId, patch);
  await audit(kitId, null, role, "kit.updated", Object.keys(patch).join(", "));
}

export type KitItemKind = "rules" | "terms" | "facts";

const NOT_YOURS = "That item belongs to another organisation.";

export async function upsertKitItem(kitId: string, kind: KitItemKind, item: Rule | Term | Fact, role: Role) {
  await ensureSeeded();
  const s = store();
  const existing = await s.get<{ kitId: string }>(kind, item.id);
  if (existing && existing.kitId !== kitId) throw new ConflictError(NOT_YOURS);
  if (existing) await s.update(kind, item.id, { ...item });
  else await s.insert(kind, [{ ...item, kitId } as unknown as Row]);
  await audit(kitId, null, role, `kit.${kind}.${existing ? "updated" : "added"}`, item.id);
}

export async function deleteKitItem(kitId: string, kind: KitItemKind, id: string, role: Role) {
  await ensureSeeded();
  const s = store();
  const existing = await s.get<{ kitId: string }>(kind, id);
  if (existing && existing.kitId !== kitId) throw new ConflictError(NOT_YOURS);
  await s.remove(kind, id);
  await audit(kitId, null, role, `kit.${kind}.deleted`, id);
}

export async function nextId(kitId: string, kind: KitItemKind): Promise<string> {
  const kit = await getKit(kitId);
  const orgPrefix = ORGS.find((o) => o.id === kitId)?.idPrefix ?? "";
  const prefix = kind === "terms" ? "T-" : kind === "facts" ? "F" : "R-";
  const list = kind === "terms" ? kit.terms : kind === "facts" ? kit.facts : kit.rules;
  const nums = list.map((x) => parseInt(x.id.replace(/\D+/g, ""), 10)).filter((n) => !Number.isNaN(n));
  return kind === "rules" ? `${orgPrefix}R-${uid("x").slice(-5)}` : `${orgPrefix}${prefix}${(nums.length ? Math.max(...nums) : 0) + 1}`;
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

async function insertSubmission(kit: BrandKit, input: NewSubmission, result: ReviewResult, role: Role, at = now()): Promise<Submission> {
  const s = store();
  const sub: Submission = {
    id: uid("s"),
    kitId: kit.id,
    createdBy: role,
    title: input.title,
    channel: input.channel,
    aiAssisted: input.aiAssisted,
    keyMessage: input.keyMessage,
    status: "draft",
    createdAt: at,
    updatedAt: at,
  };
  await s.insert("submissions", [sub as unknown as Row]);
  await insertRevision(kit, sub.id, 1, input.text, input.image, result, at);
  await audit(kit.id, sub.id, role, "submission.created", `v1 checked · score ${result.score} · ${plural(result.findings.length, "finding")}`, at);
  await auditAi(kit.id, sub.id, role, result, at);
  return sub;
}

interface PriorRevision {
  n: number;
  findings: FindingDbRow[];
}

async function insertRevision(kit: BrandKit, submissionId: string, n: number, text: string, image: ImageInput | null, result: ReviewResult, at = now(), prior?: PriorRevision) {
  const s = store();
  const media = mediaKey(image);
  const { all, pins } = await teamHistory(kit);
  const stamped = applyCalibration(result.findings, learnedRules(kit, all, pins)).map((f) => ({ ...f, fingerprint: fingerprint(f, itemHash(f.cites.kind, kitItem(kit, f.cites.kind, f.cites.id)), media) }));
  const findings = prior ? carryDecisions(prior.findings, stamped, prior.n) : stamped;
  const revisionScore = score(findings);
  const rev: Revision = {
    id: uid("v"),
    submissionId,
    n,
    text,
    image,
    imageReport: result.imageReport,
    video: result.video ?? null,
    score: revisionScore,
    ai: result.ai,
    claims: result.claims,
    dropped: result.dropped,
    createdAt: at,
  };
  await s.insert("revisions", [rev as unknown as Row]);
  await s.insert(
    "findings",
    findings.map((f) => toDbFinding({ ...f, revisionId: rev.id, submissionId }, at) as unknown as Row)
  );
  return { rev, fingerprints: new Set(findings.flatMap((f) => (f.fingerprint ? [f.fingerprint] : []))) };
}

export async function createSubmission(kit: BrandKit, input: NewSubmission, result: ReviewResult, role: Role) {
  await ensureSeeded();
  return insertSubmission(kit, input, result, role);
}

export async function addRevision(kit: BrandKit, id: string, text: string, image: ImageInput | null, result: ReviewResult, role: Role) {
  const s = store();
  const revs = await s.list<Revision>("revisions", { submissionId: id });
  const latest = [...revs].sort((a, b) => b.n - a.n)[0];
  const n = (latest?.n ?? 0) + 1;
  const priorFindings = latest ? await s.list<FindingDbRow>("findings", { revisionId: latest.id }) : [];
  const at = now();
  const { rev, fingerprints } = await insertRevision(kit, id, n, text, image, result, at, latest ? { n: latest.n, findings: priorFindings } : undefined);
  await recordImplicitAcceptance(kit, id, priorFindings, fingerprints, text, latest?.n ?? 0, role, at);
  await s.update("submissions", id, { updatedAt: at, status: "draft" });
  await audit(kit.id, id, role, "revision.created", `v${n} checked · score ${rev.score} · ${plural(result.findings.length, "finding")}`);
  await auditAi(kit.id, id, role, result);
  return rev;
}

/** Fixing a finding by editing is a decision too. It goes in the ledger as a quiet "this was right". */
async function recordImplicitAcceptance(kit: BrandKit, submissionId: string, prior: FindingDbRow[], fingerprints: Set<string>, text: string, revisionN: number, role: Role, at: string) {
  const fixed = implicitlyAccepted(prior, fingerprints, text);
  if (!fixed.length) return;
  const submission = await store().get<Submission>("submissions", submissionId);
  await store().insert(
    "finding_decisions",
    fixed.map((f) =>
      ledgerRow(kit.id, f, {
        fromStatus: "open",
        toStatus: "accepted",
        kind: "implicit",
        reasonCode: null,
        role,
        isDraftAuthor: role === submission?.createdBy,
        revisionN,
        ruleVersionHash: itemHash(f.cites.kind, kitItem(kit, f.cites.kind, f.cites.id)),
        isSeed: false,
        at,
      })
    )
  );
}

// List screens never load image data, which can be hundreds of KB per revision.
type RevisionSummary = Pick<Revision, "id" | "submissionId" | "n" | "text" | "score">;
const REVISION_SUMMARY = ["id", "submissionId", "n", "text", "score"];

export interface SubmissionSummary extends Submission {
  version: number;
  score: number;
  blockers: number;
  warnings: number;
  suggestions: number;
  routed: number;
  excerpt: string;
}

export async function listSubmissions(kitId: string): Promise<SubmissionSummary[]> {
  await ensureSeeded();
  const s = store();
  const [subs, revs, finds] = await Promise.all([
    s.list<Submission>("submissions", { kitId }),
    s.list<RevisionSummary>("revisions", undefined, { columns: REVISION_SUMMARY }),
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

export async function getSubmission(kitId: string, id: string): Promise<SubmissionDetail | null> {
  await ensureSeeded();
  const s = store();
  const submission = await s.get<Submission>("submissions", id);
  if (!submission || submission.kitId !== kitId) return null;
  const revisions = (await s.list<Revision>("revisions", { submissionId: id })).sort((a, b) => a.n - b.n);
  const latest = revisions[revisions.length - 1];
  const findings = latest ? await s.list<FindingDbRow>("findings", { revisionId: latest.id }) : [];
  const order = { blocker: 0, warning: 1, suggestion: 2 } as const;
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.start - b.start);
  const log = (await s.list<AuditEntry>("audit", { submissionId: id })).sort((a, b) => b.at.localeCompare(a.at));
  return { submission, revisions, findings, audit: log };
}

export async function getFinding(kitId: string, id: string) {
  const s = store();
  const finding = await s.get<FindingDbRow>("findings", id);
  if (!finding) return null;
  const submission = await s.get<Submission>("submissions", finding.submissionId);
  return submission?.kitId === kitId ? finding : null;
}

// ---------- decisions ----------

interface LedgerFields {
  fromStatus?: string;
  toStatus: FindingStatus;
  kind: "explicit" | "implicit";
  reasonCode: ReasonCode | null;
  role: Role;
  isDraftAuthor: boolean;
  revisionN: number;
  ruleVersionHash: string;
  isSeed: boolean;
  at: string;
}

function ledgerRow(kitId: string, f: FindingDbRow, d: LedgerFields): Row {
  return {
    id: uid("d"),
    kitId,
    findingId: f.id,
    submissionId: f.submissionId,
    fingerprint: f.fingerprint ?? null,
    ruleKey: f.cites.id,
    citeKind: f.cites.kind,
    ruleVersionHash: d.ruleVersionHash,
    pass: f.pass,
    type: f.type,
    baseSeverity: f.calibration?.baseSeverity ?? f.severity,
    baseConfidence: f.confidence,
    ...(d.fromStatus ? { fromStatus: d.fromStatus } : {}),
    toStatus: d.toStatus,
    kind: d.kind,
    reasonCode: d.reasonCode,
    actorId: `${kitId}:${d.role}`,
    actorRole: d.role,
    isDraftAuthor: d.isDraftAuthor,
    revisionN: d.revisionN,
    isSeed: d.isSeed,
    at: d.at,
  };
}

interface Decision {
  status: FindingStatus;
  role: Role;
  reason: string | null;
  reasonCode: ReasonCode | null;
  isSeed?: boolean;
  at?: string;
}

async function applyDecision(kitId: string, f: FindingDbRow, d: Decision) {
  const s = store();
  const at = d.at ?? now();
  const [submission, revision, item] = await Promise.all([
    s.get<Submission>("submissions", f.submissionId),
    s.get<Revision>("revisions", f.revisionId),
    s.get<object>(ITEM_TABLE[f.cites.kind], f.cites.id),
  ]);
  const result = await s.decide({
    id: f.id,
    kitId,
    status: d.status,
    by: d.role,
    reason: d.reason,
    reasonCode: d.reasonCode,
    ledger: ledgerRow(kitId, f, {
      toStatus: d.status,
      kind: "explicit",
      reasonCode: d.reasonCode,
      role: d.role,
      isDraftAuthor: d.role === submission?.createdBy,
      revisionN: revision?.n ?? 1,
      ruleVersionHash: itemHash(f.cites.kind, item),
      isSeed: d.isSeed ?? false,
      at,
    }),
    audit: auditEntry(kitId, f.submissionId, d.role, `finding.${d.status}`, `${f.cites.label}: “${f.quote.slice(0, 80)}”${d.reason ? `. ${d.reason}` : ""}`, at) as unknown as Row,
  });
  if (result.locked) throw new ConflictError("This draft is approved, so its decisions are locked.");
  const rows = await s.list<FindingDbRow>("findings", { revisionId: f.revisionId });
  const newScore = score(rows);
  await s.update("revisions", f.revisionId, { score: newScore });
  return newScore;
}

/** Repeating a decision that is already recorded changes nothing, so double clicks can't skew learning. */
export async function updateFinding(kitId: string, id: string, status: FindingStatus, role: Role, reason: string | null, reasonCode: ReasonCode | null = null) {
  const f = await getFinding(kitId, id);
  if (!f) return null;
  const newScore = await applyDecision(kitId, f, { status, role, reason, reasonCode });
  return { ...f, status, decidedBy: role, reason, reasonCode, score: newScore };
}

/** Someone disagreed with what was learned: put this rule back, and leave it alone for a while. */
export async function keepRuleAtFullStrength(kitId: string, findingId: string, role: Role) {
  const f = await getFinding(kitId, findingId);
  if (!f) return null;
  const s = store();
  const submission = await s.get<Submission>("submissions", f.submissionId);
  if (submission?.status === "approved") throw new ConflictError("This draft is approved, so it is locked.");
  const at = now();
  const until = new Date(Date.now() + PIN_DAYS * 86400000).toISOString();
  await s.insert("calibration_pins", [{ id: uid("p"), kitId, ruleKey: f.cites.id, until, by: role, at }]);
  const rows = await s.list<FindingDbRow>("findings", { revisionId: f.revisionId });
  const restored = rows.map((x) => (x.cites.id === f.cites.id && x.calibration ? { ...x, severity: x.calibration.baseSeverity, calibration: null } : x));
  for (const x of restored.filter((r) => r.cites.id === f.cites.id && r.calibration === null)) await s.update("findings", x.id, { severity: x.severity, calibration: null });
  await s.update("revisions", f.revisionId, { score: score(restored) });
  await audit(kitId, f.submissionId, role, "learning.undone", `${f.cites.label} kept at full strength for ${PIN_DAYS} days`, at);
  return { until };
}

export function statusLabel(s: SubmissionStatus): string {
  return { draft: "Draft", in_review: "Sent for approval", changes_requested: "Changes requested", approved: "Approved for publishing" }[s];
}

export async function setStatus(kitId: string, id: string, status: SubmissionStatus, role: Role, note: string | null) {
  const s = store();
  await s.update("submissions", id, { status, updatedAt: now() });
  await audit(kitId, id, role, `status.${status}`, statusLabel(status) + (note ? `. ${note}` : ""));
}

// ---------- audit ----------

/** Every real AI call goes in the audit log, including the ones that failed. */
async function auditAi(kitId: string, submissionId: string, role: Role, result: ReviewResult, at = now()) {
  for (const c of result.ai.calls.filter((x) => x.status !== "skipped")) {
    const what = c.pass === "image" ? "AI image check" : c.pass === "video" ? "AI video read" : "AI tone check";
    await audit(kitId, submissionId, role, `ai.${c.pass}`, `${what} ${c.status === "ran" ? `ran on ${c.model}` : "failed"} in ${(c.ms / 1000).toFixed(1)} s: ${c.returned}`, at);
  }
}

function auditEntry(kitId: string, submissionId: string | null, role: Role, action: string, detail: string, at = now()): AuditEntry {
  return { id: uid("a"), kitId, submissionId, role, action, detail, at };
}

export async function audit(kitId: string, submissionId: string | null, role: Role, action: string, detail: string, at = now()) {
  await store().insert("audit", [auditEntry(kitId, submissionId, role, action, detail, at) as unknown as Row]);
}

export async function listAudit(kitId: string, limit = 200): Promise<(AuditEntry & { title: string | null })[]> {
  await ensureSeeded();
  const s = store();
  const [entries, subs] = await Promise.all([s.list<AuditEntry>("audit", { kitId }), s.list<Submission>("submissions", { kitId })]);
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
  learning: Learning;
}

export interface Learning {
  /** practice = invented decisions mixed into this rule's figures for the demo brand. */
  rules: (RuleCalibration & { label: string; title: string; practice: number })[];
  realDecisions: number;
  replay: ReplaySummary;
  simulatedReplay: ReplaySummary;
}

const SIMULATION_SEED = 4242;

function learningFor(kit: BrandKit, history: Awaited<ReturnType<typeof teamHistory>>, label: Map<string, { label: string; title: string }>): Learning {
  const rules = [...learnedRules(kit, history.all, history.pins).values()]
    .filter((r) => r.action !== "none" || r.pinnedUntil)
    .map((r) => ({
      ...r,
      ...(label.get(r.ruleKey) ?? { label: r.ruleKey, title: r.ruleKey }),
      practice: history.simulated.filter((d) => d.ruleKey === r.ruleKey).length,
    }));
  return { rules, realDecisions: history.real.length, replay: replay(history.real), simulatedReplay: replay(simulatedTimeline(SIMULATION_SEED, new Date())) };
}

export async function insights(kitId: string): Promise<Insights> {
  const kit = await getKit(kitId);
  const s = store();
  const [subs, allRevs, allFinds] = await Promise.all([
    s.list<Submission>("submissions", { kitId }),
    s.list<RevisionSummary>("revisions", undefined, { columns: REVISION_SUMMARY }),
    s.list<FindingDbRow>("findings"),
  ]);
  const ours = new Set(subs.map((x) => x.id));
  const revs = allRevs.filter((r) => ours.has(r.submissionId));
  const finds = allFinds.filter((f) => ours.has(f.submissionId));
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
    if (f.status !== "open" && f.status !== "disputed") st.decided++;
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
    learning: learningFor(kit, await teamHistory(kit), label),
  };
}
