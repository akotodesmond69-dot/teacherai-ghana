// Purpose: Calls Gemini (via lib/ai/gemini.ts) with our built prompt, and validates the
// response before handing it back to the caller.
// Folder: lib/ai/generateLessonNote.ts
// Depends on: GEMINI_API_KEY (server-only environment variable — see below)

import { buildSystemPrompt, buildUserPrompt, type CurriculumIndicatorInput } from './buildPrompt'
import { isValidLessonNote, type LessonGeneratedContent } from './lessonSchema'
import { geminiJson, GeminiError } from './gemini'

export async function generateLessonNote(
  indicator: CurriculumIndicatorInput
): Promise<LessonGeneratedContent> {
  // Try up to 2 times total. Malformed JSON from the model is usually a
  // one-off blip, not a sign the whole request is broken — a single retry
  // resolves most of these without ever bothering the teacher.
  const MAX_ATTEMPTS = 2
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callModelOnce(indicator)
    } catch (err) {
      lastError = err as Error
      console.warn(`Lesson generation attempt ${attempt} failed:`, lastError.message)
      // Bad key / no quota will not fix itself on an immediate retry.
      if (err instanceof GeminiError && ['auth', 'no_key', 'quota'].includes(err.kind)) break
    }
  }

  throw lastError ?? new Error('Lesson generation failed after retries.')
}

async function callModelOnce(indicator: CurriculumIndicatorInput): Promise<LessonGeneratedContent> {
  const parsed = await geminiJson({
    messages: [
      // System prompt: fixed rules, never influenced by teacher input.
      { role: 'system', content: buildSystemPrompt() },
      // User prompt: this specific request's curriculum data only.
      { role: 'user', content: buildUserPrompt(indicator) },
    ],
  })

  if (!isValidLessonNote(parsed)) {
    throw new GeminiError('invalid_shape', 'AI response was missing required lesson sections.')
  }
  return parsed
}

// ----------------------------------------------------------------------------
// Testing steps:
// 1. Call this function directly with a sample indicator (see actions.ts below
//    for the real flow).
// 2. Expected: a LessonGeneratedContent object — core_competencies,
//    key_words, tlrs, references, and the three lesson phases — all filled in.
//    (Metadata fields like Week Ending and Class Size are merged in
//    separately by actions.ts, not generated here.)
//
// Common error: "Gemini ... 401/403"
// Fix: GEMINI_API_KEY is missing or wrong in your .env.local file.
//
// Common error: "AI response was not valid JSON" on both attempts
// Fix: usually means the model is having an unusually bad response streak —
// check https://aistudio.google.com/status, or try again in a minute.
// ----------------------------------------------------------------------------
