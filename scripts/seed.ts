// Fills a new database with the two demo organisations. Usage: npm run seed
// Run supabase/schema.sql first. Safe to repeat: an already seeded database is left alone.

import { seedDemo } from "../src/lib/db/repo";
import { store } from "../src/lib/db/store";

async function main() {
  const db = store();
  if (db.kind !== "supabase") throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  await seedDemo();
  const submissions = await db.list("submissions", undefined, { columns: ["id"] });
  console.log(`Seeded. ${submissions.length} drafts in the database.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
