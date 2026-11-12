// Storage backends behind one small interface.
//  - Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
//  - A local JSON file otherwise, so the app runs with zero setup.
// Server-only. The service-role key never reaches the browser.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";

export type TableName = "kits" | "rules" | "terms" | "facts" | "submissions" | "revisions" | "findings" | "audit" | "finding_decisions" | "ai_results" | "calibration_pins";
export type Row = { id: string } & Record<string, unknown>;
export type Where = Record<string, string | number | boolean | null>;

export class ConflictError extends Error {}
export class StorageUnavailable extends Error {}

export interface ListOptions {
  /** Only these columns, so list screens can skip heavy image data. */
  columns?: string[];
}

export interface Store {
  kind: "supabase" | "file" | "none";
  list<T>(table: TableName, where?: Where, options?: ListOptions): Promise<T[]>;
  get<T>(table: TableName, id: string): Promise<T | null>;
  insert(table: TableName, rows: Row[]): Promise<void>;
  update(table: TableName, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  /** Records one decision atomically: the finding, the ledger row and the audit row, or none of them. */
  decide(input: DecideInput): Promise<DecideResult>;
  /** Clears demo data so it can be seeded again. Stored AI answers stay. */
  reset(): Promise<void>;
  /** Counts one request across every server instance. Only the Supabase store can do this. */
  takeRateLimit?(key: string, limit: number, windowMs: number): Promise<boolean>;
}

export interface DecideInput {
  id: string;
  kitId: string;
  status: string;
  by: string;
  reason: string | null;
  reasonCode: string | null;
  /** Everything except fromStatus, which is read under the row lock. */
  ledger: Row;
  audit: Row;
}

export interface DecideResult {
  found: boolean;
  changed: boolean;
  locked: boolean;
  fromStatus?: string;
}

const TABLES: TableName[] = ["kits", "rules", "terms", "facts", "submissions", "revisions", "findings", "audit", "finding_decisions", "ai_results", "calibration_pins"];
const CITE_COLUMN: Partial<Record<TableName, string>> = { rules: "ruleId", terms: "termId", facts: "factId" };

// ---------- file store ----------

type Db = Record<TableName, Row[]>;

type FileState = { db: Db | null; writing: Promise<void> };

// Next bundles route handlers and pages separately, so this module is evaluated more than
// once per server process. The cached data must live on globalThis: with a module-level
// copy, a page keeps reading stale data and the bundles overwrite each other on disk.
const FILE_STATE = Symbol.for("plumbline.fileStore");

function fileState(file: string): FileState {
  const registry = globalThis as unknown as Record<symbol, Map<string, FileState> | undefined>;
  const states = (registry[FILE_STATE] ??= new Map<string, FileState>());
  const existing = states.get(file);
  if (existing) return existing;
  const created: FileState = { db: null, writing: Promise.resolve() };
  states.set(file, created);
  return created;
}

function fileStore(): Store {
  const file =
    process.env.PLUMBLINE_DATA_FILE ??
    (process.env.VERCEL ? "/tmp/plumbline.json" : path.join(process.cwd(), ".data", "plumbline.json"));
  const state = fileState(file);

  async function load(): Promise<Db> {
    if (state.db) return state.db;
    let loaded: Db;
    try {
      loaded = JSON.parse(await fs.readFile(file, "utf8")) as Db;
    } catch {
      loaded = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Db;
    }
    for (const t of TABLES) loaded[t] ??= [];
    state.db ??= loaded; // two first reads can overlap: keep whichever landed first
    return state.db;
  }

  function persist(): Promise<void> {
    const snapshot = JSON.stringify(state.db);
    state.writing = state.writing
      .then(() => fs.mkdir(path.dirname(file), { recursive: true }))
      .then(() => fs.writeFile(file, snapshot, "utf8"))
      .catch((e) => console.error("[plumbline] could not write data file", e));
    return state.writing;
  }

  const matches = (row: Row, where?: Where) => !where || Object.entries(where).every(([k, v]) => row[k] === v);

  return {
    kind: "file",
    async list<T>(table: TableName, where?: Where, options?: ListOptions) {
      const d = await load();
      const rows = d[table].filter((r) => matches(r, where)).map((r) => structuredClone(r));
      const columns = options?.columns;
      return (columns ? rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c]]))) : rows) as T[];
    },
    async get<T>(table: TableName, id: string) {
      const d = await load();
      const row = d[table].find((r) => r.id === id);
      return row ? (structuredClone(row) as T) : null;
    },
    async insert(table, rows) {
      const d = await load();
      for (const r of rows) {
        if (d[table].some((x) => x.id === r.id)) throw new ConflictError(`${table} ${r.id} already exists`);
      }
      d[table] = [...d[table], ...rows.map((r) => structuredClone(r))];
      await persist();
    },
    async update(table, id, patch) {
      const d = await load();
      d[table] = d[table].map((r) => (r.id === id ? { ...r, ...structuredClone(patch), id } : r));
      await persist();
    },
    async remove(table, id) {
      const d = await load();
      const col = CITE_COLUMN[table];
      if (col && d.findings.some((f) => f[col] === id)) {
        throw new ConflictError("This item is cited by existing findings, so it can't be deleted. Edit it instead.");
      }
      d[table] = d[table].filter((r) => r.id !== id);
      await persist();
    },
    async decide({ id, kitId, status, by, reason, reasonCode, ledger, audit }) {
      const d = await load();
      // No await between the check and the write, so parallel requests can't both pass it.
      const finding = d.findings.find((f) => f.id === id);
      const submission = d.submissions.find((x) => x.id === finding?.submissionId && x.kitId === kitId);
      if (!finding || !submission) return { found: false, changed: false, locked: false };
      if (submission.status === "approved") return { found: true, changed: false, locked: true };
      const fromStatus = finding.status as string;
      if (fromStatus === status) return { found: true, changed: false, locked: false, fromStatus };
      d.findings = d.findings.map((f) => (f.id === id ? { ...f, status, decidedBy: by, reason, reasonCode } : f));
      d.finding_decisions = [...d.finding_decisions, structuredClone({ ...ledger, fromStatus }) as Row];
      d.audit = [...d.audit, structuredClone(audit)];
      d.submissions = d.submissions.map((x) => (x.id === submission.id ? { ...x, updatedAt: new Date().toISOString() } : x));
      await persist();
      return { found: true, changed: true, locked: false, fromStatus };
    },
    async reset() {
      const d = await load();
      for (const t of TABLES) if (t !== "ai_results") d[t] = [];
      await persist();
    },
  };
}

// ---------- no storage ----------

const NOT_SAVED = "Saving is switched off because this site has no database connected.";

/** A hosted server with no database. Reads are empty and writes refuse, so nothing vanishes silently. */
function unavailableStore(): Store {
  const refuse = async () => {
    throw new StorageUnavailable(NOT_SAVED);
  };
  return {
    kind: "none",
    list: async <T>() => [] as T[],
    get: async () => null,
    insert: refuse,
    update: refuse,
    remove: refuse,
    decide: refuse,
    reset: refuse,
  };
}

// ---------- supabase store ----------

const PAGE_SIZE = 1000;

function supabaseStore(url: string, key: string): Store {
  const sb: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });
  const fail = (e: { message: string; code?: string } | null) => {
    if (!e) return;
    if (e.code === "23503") throw new ConflictError("This item is cited by existing findings, so it can't be deleted. Edit it instead.");
    if (e.code === "23505") throw new ConflictError(e.message);
    throw new Error(`Database error: ${e.message}`);
  };
  return {
    kind: "supabase",
    async list<T>(table: TableName, where?: Where, options?: ListOptions) {
      // Supabase returns at most 1,000 rows per request, so read in pages with a fixed order.
      const rows: T[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        let q = sb.from(table).select(options?.columns?.join(",") ?? "*");
        for (const [k, v] of Object.entries(where ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v);
        const { data, error } = await q.order("id").range(from, from + PAGE_SIZE - 1);
        fail(error);
        const page = (data ?? []) as unknown as T[];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;
      }
    },
    async get<T>(table: TableName, id: string) {
      const { data, error } = await sb.from(table).select("*").eq("id", id).maybeSingle();
      fail(error);
      return (data ?? null) as T | null;
    },
    async insert(table, rows) {
      if (!rows.length) return;
      const { error } = await sb.from(table).insert(rows);
      fail(error);
    },
    async update(table, id, patch) {
      const { error } = await sb.from(table).update(patch).eq("id", id);
      fail(error);
    },
    async remove(table, id) {
      const { error } = await sb.from(table).delete().eq("id", id);
      fail(error);
    },
    async decide({ id, kitId, status, by, reason, reasonCode, ledger, audit }) {
      const { data, error } = await sb.rpc("decide_finding", {
        p_id: id,
        p_kit: kitId,
        p_status: status,
        p_by: by,
        p_reason: reason,
        p_reason_code: reasonCode,
        p_ledger: ledger,
        p_audit: audit,
      });
      fail(error);
      return data as DecideResult;
    },
    async reset() {
      const { error } = await sb.rpc("reset_demo");
      fail(error);
    },
    async takeRateLimit(key, limit, windowMs) {
      const { data, error } = await sb.rpc("take_rate_limit", { p_key: key, p_limit: limit, p_window_ms: windowMs });
      fail(error);
      return data === true;
    },
  };
}

let instance: Store | null = null;

export function store(): Store {
  if (instance) return instance;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // A file on a hosted server is per-instance and temporary, which is how saved work used to vanish.
  instance = url && key ? supabaseStore(url, key) : process.env.VERCEL ? unavailableStore() : fileStore();
  return instance;
}
