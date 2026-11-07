// Minimal Gemini client over REST. Server-only: the key never reaches the browser.
// Swappable: everything else talks to the `LlmProvider` interface.

export interface LlmPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface LlmProvider {
  name: string;
  json<T = unknown>(system: string, parts: LlmPart[], opts?: { timeoutMs?: number }): Promise<T>;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class LlmError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function candidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [...new Set([preferred, "gemini-2.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"].filter(Boolean) as string[])];
}

/** Strip code fences and parse the first JSON value in a model reply. */
export function parseJson<T>(raw: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new LlmError("Model did not return JSON");
  }
}

let workingModel: string | null = null;

const SEED = 7; // with temperature 0, keeps repeat checks as steady as the model allows

// Overload, rate-limit and server errors are worth trying on the next model; bad requests are not.
const RETRYABLE = new Set([404, 429, 500, 502, 503, 504]);

export function geminiProvider(): LlmProvider | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return {
    get name() {
      return `Google Gemini · ${workingModel ?? candidates()[0]}`;
    },
    async json<T>(system: string, parts: LlmPart[], opts?: { timeoutMs?: number }): Promise<T> {
      const models = [...new Set([workingModel, ...candidates()].filter(Boolean) as string[])];
      let lastError: unknown = null;
      for (const model of models) {
        const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts }],
            generationConfig: { responseMimeType: "application/json", temperature: 0, seed: SEED },
          }),
          signal: AbortSignal.timeout(opts?.timeoutMs ?? 18000),
        }).catch((e: unknown) => {
          lastError = e;
          return null;
        });
        if (!res) continue;
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const message = (/"message":\s*"([^"]+)"/.exec(body)?.[1] ?? body).slice(0, 160);
          lastError = new LlmError(`Gemini ${res.status} on ${model}: ${message}`, res.status);
          if (RETRYABLE.has(res.status)) continue;
          throw lastError;
        }
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        workingModel = model;
        return parseJson<T>(text);
      }
      throw lastError instanceof Error ? lastError : new LlmError("Gemini unavailable");
    },
  };
}
