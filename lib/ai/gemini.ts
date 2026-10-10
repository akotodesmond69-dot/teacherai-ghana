// Purpose: ONE place that talks to the Gemini API. Every AI feature (lessons,
// exams, assessments, exercises, scheme summaries, assistant chat) goes
// through geminiChat() so that retry, fallback and error handling are fixed
// once instead of copy-pasted into six files.
//
// Folder: lib/ai/gemini.ts
// Depends on: GEMINI_API_KEY (server-only). Optional: GEMINI_MODEL.
//
// WHAT THIS FIXES (see the project notes for the full reasoning):
//  1. Model fallback. Free-tier quotas are counted PER MODEL, so when the
//     preferred model returns 429 (quota) / 503 (overloaded) / 404 (retired)
//     we automatically try the next model instead of failing the teacher.
//  2. Backoff. The old code retried instantly, which just burns the same
//     per-minute quota again. We now wait (honouring Retry-After) first.
//  3. Thinking budget. Gemini 3.x thinks at "high" by default, which is slow
//     and counts against output tokens. JSON generation does not need that,
//     so we ask for reasoning_effort "low".
//  4. Temperature. Google strongly recommends leaving temperature at the
//     default (1.0) for ALL Gemini 3 models — lower values can cause looping
//     or degraded output. We therefore no longer send a temperature at all.
//  5. Timeout. Each call is capped so the server action finishes (or fails
//     cleanly) before the host's function time limit instead of hanging.
//  6. Truncation / empty replies are detected and reported, not silently
//     turned into "not valid JSON".
//  7. Real error kinds, so the UI can say "free limit reached, try in a few
//     minutes" instead of a generic "something went wrong".

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

// Order matters: best first. All three are available on the free tier as of
// Oct 2026 (https://ai.google.dev/gemini-api/docs/pricing). 3.6 is the
// previous generation and 3.5-flash-lite is the lightweight last resort.
// Set GEMINI_MODEL in .env.local (comma-separated allowed) to put your own
// choice first without touching code.
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite']

export function getModelChain(): string[] {
  const fromEnv = (process.env.GEMINI_MODEL ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return Array.from(new Set([...fromEnv, ...DEFAULT_MODELS]))
}

export type GeminiErrorKind =
  | 'no_key'
  | 'auth'        // 401 / 403 — bad, revoked or leaked key, or region/project problem
  | 'quota'       // 429 — free-tier RPM / TPM / RPD exhausted
  | 'overloaded'  // 500 / 503 / 504 — Google side, usually temporary
  | 'bad_request' // 400 / 404 — bad parameter or retired/unknown model
  | 'timeout'
  | 'network'
  | 'truncated'   // finish_reason === 'length'
  | 'empty'       // no text came back (e.g. blocked or thinking used the whole budget)
  | 'bad_json'
  | 'invalid_shape'

export class GeminiError extends Error {
  kind: GeminiErrorKind
  status?: number
  retryAfterMs?: number
  constructor(kind: GeminiErrorKind, message: string, status?: number, retryAfterMs?: number) {
    super(message)
    this.name = 'GeminiError'
    this.kind = kind
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

export interface GeminiRequest {
  messages: unknown[]
  /** Ask for a JSON object back. The reply is still parsed defensively. */
  json?: boolean
  /** Thinking effort. 'low' is plenty for template-style JSON and is much faster. */
  reasoningEffort?: 'low' | 'medium' | 'high'
}

// Total wall-clock budget for one geminiChat() call, across all retries and
// fallbacks. Keep it under the route's maxDuration (60s — see the layout.tsx
// files next to each feature).
const TOTAL_BUDGET_MS = Number(process.env.GEMINI_TOTAL_TIMEOUT_MS ?? 55_000)
const PER_ATTEMPT_MS = 40_000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function classify(status: number): GeminiErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 429) return 'quota'
  if (status >= 500) return 'overloaded'
  return 'bad_request'
}

function parseRetryAfter(res: Response): number | undefined {
  const h = res.headers.get('retry-after')
  if (!h) return undefined
  const secs = Number(h)
  return Number.isFinite(secs) ? secs * 1000 : undefined
}

async function requestOnce(
  model: string,
  req: GeminiRequest,
  optionalParams: boolean,
  timeoutMs: number
): Promise<string> {
  const body: Record<string, unknown> = { model, messages: req.messages }
  if (optionalParams) {
    body.reasoning_effort = req.reasoningEffort ?? 'low'
    if (req.json) body.response_format = { type: 'json_object' }
  }

  let res: Response
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const name = (err as Error)?.name
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new GeminiError('timeout', `Gemini (${model}) timed out after ${timeoutMs}ms`)
    }
    throw new GeminiError('network', `Network error calling Gemini (${model}): ${(err as Error).message}`)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new GeminiError(
      classify(res.status),
      `Gemini (${model}) ${res.status} ${res.statusText} — ${text.slice(0, 500)}`,
      res.status,
      parseRetryAfter(res)
    )
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  const content: string = choice?.message?.content ?? ''

  if (choice?.finish_reason === 'length') {
    throw new GeminiError('truncated', `Gemini (${model}) reply was cut off (hit the output token limit).`)
  }
  if (!content.trim()) {
    throw new GeminiError(
      'empty',
      `Gemini (${model}) returned no text (finish_reason: ${choice?.finish_reason ?? 'unknown'}).`
    )
  }
  return content
}

/**
 * Sends the request, walking the model chain with backoff. Returns the raw
 * text of the reply. Throws a GeminiError describing the LAST failure.
 */
export async function geminiChat(req: GeminiRequest): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    throw new GeminiError('no_key', 'GEMINI_API_KEY is not set in the server environment.')
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS
  const remaining = () => deadline - Date.now()
  let lastError: GeminiError | null = null

  for (const model of getModelChain()) {
    let optionalParams = true // flips to false if Gemini rejects reasoning_effort / response_format
    let attempt = 0

    while (attempt < 2) {
      if (remaining() < 3_000) {
        throw lastError ?? new GeminiError('timeout', 'Ran out of time before the AI could respond.')
      }
      try {
        return await requestOnce(model, req, optionalParams, Math.min(PER_ATTEMPT_MS, remaining()))
      } catch (err) {
        const e = err instanceof GeminiError ? err : new GeminiError('network', (err as Error).message)
        lastError = e
        console.warn(`[gemini] ${model} attempt ${attempt + 1} failed (${e.kind}):`, e.message)

        // A bad key will fail on every model — stop immediately.
        if (e.kind === 'auth') throw e

        // 400 might just mean this model dislikes an optional parameter.
        // Retry the SAME model once with a plain request before giving up on it.
        if (e.status === 400 && optionalParams) {
          optionalParams = false
          continue
        }

        // Temporary problem (quota burst / overloaded / network blip): wait
        // briefly and try the same model once more, then fall through.
        if ((e.kind === 'quota' || e.kind === 'overloaded' || e.kind === 'network') && attempt === 0) {
          const wait = Math.min(e.retryAfterMs ?? 2_000, 8_000, Math.max(remaining() - 5_000, 0))
          if (wait > 0) await sleep(wait)
          attempt++
          continue
        }

        break // give up on this model, move to the next one in the chain
      }
    }
  }

  throw lastError ?? new GeminiError('empty', 'No response from Gemini.')
}

/**
 * Pulls a JSON value out of model text. Handles ```json fences and any
 * stray sentence before/after the JSON.
 */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    // fall through to bracket matching
  }
  const firstObj = cleaned.indexOf('{')
  const firstArr = cleaned.indexOf('[')
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr)
  if (start === -1) throw new GeminiError('bad_json', 'AI reply did not contain any JSON.')
  const closer = cleaned[start] === '{' ? '}' : ']'
  const end = cleaned.lastIndexOf(closer)
  if (end <= start) throw new GeminiError('bad_json', 'AI reply contained incomplete JSON.')
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new GeminiError('bad_json', 'AI reply was not valid JSON.')
  }
}

/** Convenience: call Gemini and parse the JSON reply. */
export async function geminiJson(req: Omit<GeminiRequest, 'json'>): Promise<unknown> {
  const text = await geminiChat({ ...req, json: true })
  return extractJson(text)
}

/** A message that is safe to show a teacher. Full detail stays in server logs. */
export function friendlyAiError(err: unknown, what = 'content'): string {
  const kind = err instanceof GeminiError ? err.kind : undefined
  switch (kind) {
    case 'quota':
      return `The AI service has hit its free usage limit for now. Please wait a few minutes and try generating your ${what} again.`
    case 'overloaded':
    case 'timeout':
    case 'network':
      return `The AI service is busy right now. Please try generating your ${what} again in a minute.`
    case 'auth':
    case 'no_key':
      return 'The AI service is not set up correctly (API key problem). Please contact support.'
    case 'truncated':
      return `The ${what} was too long for the AI to finish. Please try again.`
    default:
      return `Something went wrong generating your ${what}. Please try again.`
  }
}
