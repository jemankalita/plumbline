// Minimal Gemini client over REST. Server-only: the key never reaches the browser.
// Swappable: everything else talks to the `LlmProvider` interface.

export interface LlmPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface LlmOptions {
  /** Longest wait for one model. */
  timeoutMs?: number;
  /** Longest wait across every model tried, so a slow day cannot outlast the route. */
  deadlineMs?: number;
  /** Use only the configured model, so a measured run never mixes models. */
  onlyPreferred?: boolean;
}

export interface LlmProvider {
  name: string;
  json<T = unknown>(system: string, parts: LlmPart[], opts?: LlmOptions): Promise<T>;
}

/** Overall AI budget for a route with maxDuration = 60. */
export const ROUTE_AI_DEADLINE_MS = 50000;

const DEFAULT_TIMEOUT_MS = 18000;
const MIN_ATTEMPT_MS = 3000; // less than this cannot finish a model call

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export class LlmError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

function candidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  return [...new Set([preferred, "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-flash-latest"].filter(Boolean) as string[])];
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
    async json<T>(system: string, parts: LlmPart[], opts?: LlmOptions): Promise<T> {
      const models = opts?.onlyPreferred ? candidates().slice(0, 1) : [...new Set([workingModel, ...candidates()].filter(Boolean) as string[])];
      const deadline = opts?.deadlineMs === undefined ? null : Date.now() + opts.deadlineMs;
      let lastError: unknown = null;
      for (const [index, model] of models.entries()) {
        const left = deadline === null ? Infinity : deadline - Date.now();
        if (index > 0 && left < MIN_ATTEMPT_MS) break;
        const res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts }],
            generationConfig: { responseMimeType: "application/json", temperature: 0, seed: SEED },
          }),
          signal: AbortSignal.timeout(Math.min(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS, left)),
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
        const data = (await res.json().catch((e: unknown) => {
          lastError = e; // a stalled reply should fall through to the next model
          return null;
        })) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        } | null;
        if (!data) continue;
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        workingModel = model;
        return parseJson<T>(text);
      }
      throw lastError instanceof Error ? lastError : new LlmError("Gemini unavailable");
    },
  };
}
