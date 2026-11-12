// Proves a backup can be restored: exports every table, clears the data, loads it back and compares row by row.
// Usage: npx tsx --conditions=react-server --env-file=.env.local scripts/restore-test.ts
// Only run this against the demo database. The export is kept in .data/ in case a step fails.

import { mkdirSync, writeFileSync } from "node:fs";
import { store, type Row, type TableName } from "../src/lib/db/store";

const TABLES: TableName[] = ["kits", "rules", "terms", "facts", "submissions", "revisions", "findings", "finding_decisions", "audit", "calibration_pins"];
const CHUNK = 50;
const BACKUP_FILE = ".data/restore-test-backup.json";

/** The same value always prints the same way, whatever order the database returns object keys in. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function exportAll(): Promise<Record<string, Row[]>> {
  const db = store();
  const entries = await Promise.all(TABLES.map(async (table) => [table, await db.list<Row>(table)] as const));
  return Object.fromEntries(entries);
}

function differences(before: Record<string, Row[]>, after: Record<string, Row[]>): string[] {
  return TABLES.flatMap((table) => {
    const restored = new Map(after[table].map((row) => [row.id, canonical(row)]));
    const changed = before[table].filter((row) => restored.get(row.id) !== canonical(row)).length;
    const counts = before[table].length === after[table].length;
    return counts && changed === 0 ? [] : [`${table}: ${before[table].length} before, ${after[table].length} after, ${changed} differ`];
  });
}

async function main() {
  const db = store();
  if (db.kind !== "supabase") throw new Error("This test needs the Supabase store.");
  const before = await exportAll();
  mkdirSync(".data", { recursive: true });
  writeFileSync(BACKUP_FILE, JSON.stringify(before));
  await db.reset();
  for (const table of TABLES) {
    for (let i = 0; i < before[table].length; i += CHUNK) await db.insert(table, before[table].slice(i, i + CHUNK));
  }
  const problems = differences(before, await exportAll());
  console.log(TABLES.map((table) => `${table} ${before[table].length}`).join(", "));
  if (problems.length) throw new Error(`Restore did not match:\n${problems.join("\n")}`);
  console.log("Restore matched every row.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
