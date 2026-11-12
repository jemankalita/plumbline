// Clears the demo database and seeds it again. Usage: npm run reset
// Removes every draft, decision and audit row, including test data. Stored AI answers stay.

import { geminiProvider } from "../src/lib/ai/gemini";
import { resetDemo } from "../src/lib/db/repo";
import { storedProvider } from "../src/lib/db/stored-ai";
import { store } from "../src/lib/db/store";

async function main() {
  const db = store();
  if (db.kind !== "supabase") throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.");
  // Stored answers survive a reset, so this spends AI quota only the first time.
  await resetDemo(storedProvider(geminiProvider()));
  const drafts = await db.list("submissions", undefined, { columns: ["id"] });
  console.log(`Reset done. ${drafts.length} demo drafts in the database.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
