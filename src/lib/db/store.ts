// Storage backends behind one small interface.
//  - Supabase (Postgres) when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
//  - A local JSON file otherwise, so the app runs with zero setup.
// Server-only. The service-role key never reaches the browser.

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";

export type TableName = "kits" | "rules" | "terms" | "facts" | "submissions" | "revisions" | "findings" | "audit";
export type Row = { id: string } & Record<string, unknown>;
export type Where = Record<string, string | number | boolean | null>;

export class ConflictError extends Error {}

export interface Store {
  kind: "supabase" | "file";
  list<T>(table: TableName, where?: Where): Promise<T[]>;
  get<T>(table: TableName, id: string): Promise<T | null>;
  insert(table: TableName, rows: Row[]): Promise<void>;
  update(table: TableName, id: string, patch: Record<string, unknown>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
}

const TABLES: TableName[] = ["kits", "rules", "terms", "facts", "submissions", "revisions", "findings", "audit"];
const CITE_COLUMN: Partial<Record<TableName, string>> = { rules: "ruleId", terms: "termId", facts: "factId" };

// ---------- file store ----------

type Db = Record<TableName, Row[]>;

function fileStore(): Store {
  const file =
    process.env.PLUMBLINE_DATA_FILE ??
    (process.env.VERCEL ? "/tmp/plumbline.json" : path.join(process.cwd(), ".data", "plumbline.json"));
  let db: Db | null = null;
  let writing: Promise<void> = Promise.resolve();

  async function load(): Promise<Db> {
    if (db) return db;
    try {
      db = JSON.parse(await fs.readFile(file, "utf8")) as Db;
    } catch {
      db = Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Db;
    }
    for (const t of TABLES) db[t] ??= [];
    return db;
  }

  function persist(): Promise<void> {
    const snapshot = JSON.stringify(db);
    writing = writing
      .then(() => fs.mkdir(path.dirname(file), { recursive: true }))
      .then(() => fs.writeFile(file, snapshot, "utf8"))
      .catch((e) => console.error("[plumbline] could not write data file", e));
    return writing;
  }

  const matches = (row: Row, where?: Where) => !where || Object.entries(where).every(([k, v]) => row[k] === v);

  return {
    kind: "file",
    async list<T>(table: TableName, where?: Where) {
      const d = await load();
      return d[table].filter((r) => matches(r, where)).map((r) => structuredClone(r)) as T[];
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
  };
}

// ---------- supabase store ----------

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
    async list<T>(table: TableName, where?: Where) {
      let q = sb.from(table).select("*");
      for (const [k, v] of Object.entries(where ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v);
      const { data, error } = await q.limit(5000);
      fail(error);
      return (data ?? []) as T[];
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
  };
}

let instance: Store | null = null;

export function store(): Store {
  if (instance) return instance;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  instance = url && key ? supabaseStore(url, key) : fileStore();
  return instance;
}
