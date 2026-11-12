import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reply = (body: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }] }), { status: 200 });
const overloaded = () => new Response('{"error":{"message":"overloaded"}}', { status: 503 });
const modelOf = (call: unknown[]) => /models\/([^:]+):/.exec(String(call[0]))?.[1];

// The working model is remembered per module, so each test needs a fresh copy.
async function provider() {
  vi.resetModules();
  const { geminiProvider } = await import("../src/lib/ai/gemini");
  return geminiProvider()!;
}

describe("Gemini model chain and overall deadline", () => {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("tries current models in order and never the deprecated one", async () => {
    // Arrange
    fetchMock.mockImplementation(async () => overloaded());
    const p = await provider();

    // Act
    await expect(p.json("s", [{ text: "x" }])).rejects.toThrow(/503/);

    // Assert
    expect(fetchMock.mock.calls.map(modelOf)).toEqual(["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-latest"]);
  });

  it("moves to the next model when one is overloaded", async () => {
    // Arrange
    fetchMock.mockResolvedValueOnce(overloaded()).mockResolvedValueOnce(reply({ ok: true }));
    const p = await provider();

    // Act
    const result = await p.json("s", [{ text: "x" }]);

    // Assert
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not start another model when too little of the deadline is left", async () => {
    // Arrange
    fetchMock.mockImplementation(async () => overloaded());
    const p = await provider();

    // Act
    await expect(p.json("s", [{ text: "x" }], { deadlineMs: 2000 })).rejects.toThrow(/503/);

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops one model's wait at the overall deadline", async () => {
    // Arrange
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(reply({ ok: true }));
    const p = await provider();

    // Act
    await p.json("s", [{ text: "x" }], { timeoutMs: 25000, deadlineMs: 5000 });

    // Assert
    expect(timeout.mock.calls[0][0]).toBeLessThanOrEqual(5000);
  });

  it("keeps the per-model limit when the deadline is further away", async () => {
    // Arrange
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(reply({ ok: true }));
    const p = await provider();

    // Act
    await p.json("s", [{ text: "x" }], { timeoutMs: 25000, deadlineMs: 50000 });

    // Assert
    expect(timeout.mock.calls[0][0]).toBe(25000);
  });
});
