// Purpose: Calls the OpenAI API with our built prompt, and validates the
// response before handing it back to the caller.
// Folder: lib/ai/generateLessonNote.ts
// Depends on: GEMINI_API_KEY (server-only environment variable — see below)

import { buildSystemPrompt, buildUserPrompt, type CurriculumIndicatorInput } from './buildPrompt'
import { isValidLessonNote, type LessonGeneratedContent } from './lessonSchema'

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
    }
  }

  throw lastError ?? new Error('Lesson generation failed after retries.')
}

async function callModelOnce(indicator: CurriculumIndicatorInput): Promise<LessonGeneratedContent> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Server-only key — never NEXT_PUBLIC_ prefixed, never sent to the browser.
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      temperature: 0.3, // low = more consistent, curriculum-faithful output,
                         // rather than creative/unpredictable writing
      messages: [
        // System prompt: fixed rules, never influenced by teacher input.
        { role: 'system', content: buildSystemPrompt() },
        // User prompt: this specific request's curriculum data only.
        { role: 'user', content: buildUserPrompt(indicator) },
      ],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini request failed: ${response.status} ${response.statusText} — ${errorBody}`)
  }

  const data = await response.json()
  const rawText: string = data.choices?.[0]?.message?.content ?? ''

  // Defensive cleanup: strip markdown code fences if the model added them
  // despite our instructions not to.
  const cleaned = rawText.replace(/```json|```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI response was not valid JSON — could not parse lesson content.')
  }

  if (!isValidLessonNote(parsed)) {
    throw new Error('AI response was missing required lesson sections.')
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
// Common error: "OpenAI request failed: 401 Unauthorized"
// Fix: GEMINI_API_KEY is missing or wrong in your .env.local file.
//
// Common error: "AI response was not valid JSON" on both attempts
// Fix: usually means the model is having an unusually bad response streak —
// check OpenAI's status page, or try again in a minute.
// ----------------------------------------------------------------------------
