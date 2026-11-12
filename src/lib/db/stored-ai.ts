// Keeps every AI answer in the database. The same request gets the same answer, on any server,
// without spending quota again. A changed rule changes the request, so it asks afresh.

import "server-only";
import type { LlmOptions, LlmPart, LlmProvider } from "../ai/gemini";
import { hash } from "../engine/fingerprint";
import { ConflictError, store } from "./store";

async function save(id: string, result: unknown, model: string) {
  try {
    await store().insert("ai_results", [{ id, result, model, createdAt: new Date().toISOString() }]);
  } catch (error) {
    // Two identical requests can race to save, and that is harmless. Anything else is worth knowing about.
    if (!(error instanceof ConflictError)) console.error("[plumbline] could not store an AI answer", error);
  }
}

export function storedProvider(inner: LlmProvider | null): LlmProvider | null {
  if (!inner) return null;
  return {
    get name() {
      return inner.name;
    },
    async json<T>(system: string, parts: LlmPart[], opts?: LlmOptions): Promise<T> {
      const id = hash([system, parts]);
      const saved = await store().get<{ result: T }>("ai_results", id);
      if (saved) return saved.result;
      const result = await inner.json<T>(system, parts, opts);
      await save(id, result, inner.name);
      return result;
    },
  };
}
