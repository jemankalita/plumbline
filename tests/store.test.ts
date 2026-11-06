import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Next bundles route handlers and pages separately, so the store module is
// evaluated more than once in a single server process.
async function freshBundle() {
  vi.resetModules();
  return (await import("../src/lib/db/store")).store();
}

describe("file store across bundles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "plumbline-"));
    vi.stubEnv("PLUMBLINE_DATA_FILE", path.join(dir, "data.json"));
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("plumbline.fileStore")];
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("shows a write made by the API bundle to the page bundle", async () => {
    // Arrange
    const page = await freshBundle();
    const api = await freshBundle();
    await page.insert("findings", [{ id: "f1", status: "open" }]);
    await page.list("findings"); // the page has read the data before the decision

    // Act
    await api.update("findings", "f1", { status: "accepted" });

    // Assert
    expect(await page.get("findings", "f1")).toMatchObject({ status: "accepted" });
  });

  it("does not lose one bundle's write when another bundle writes next", async () => {
    // Arrange
    const page = await freshBundle();
    const api = await freshBundle();
    await page.insert("findings", [{ id: "f1", status: "open" }]);
    await api.list("findings");

    // Act
    await page.insert("audit", [{ id: "a1" }]);
    await api.update("findings", "f1", { status: "accepted" });

    // Assert
    expect(await api.get("audit", "a1")).toMatchObject({ id: "a1" });
    expect(await page.get("findings", "f1")).toMatchObject({ status: "accepted" });
  });
});
