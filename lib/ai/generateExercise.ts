// Purpose: Generates exercise/homework questions and a marking scheme,
// grounded strictly in teacher-uploaded content — either extracted text
// (from a PDF/Word upload) or a photo, read directly by Gemini's vision
// capability. Two input paths, one shared validation/retry core.
// Folder: lib/ai/generateExercise.ts

import { EXERCISE_JSON_SCHEMA_DESCRIPTION, isValidExerciseContent, type ExerciseContent } from './exerciseSchema'

const SYSTEM_PROMPT = `You write exercise/homework questions and a marking
scheme for Ghanaian teachers, based STRICTLY on the content provided to
you — either text extracted from a document, or a photographed page.

Rules:
1. Base every question ONLY on the actual content given to you. Do not
   introduce outside topics not present in the material.
2. Generate a sensible mix of question types (objective, short answer,
   essay) appropriate to the content and requested question count.
3. Provide a clear marking scheme / model answers a teacher can use to
   grade quickly.
4. Respond with ONLY a JSON object — no explanation, no markdown fences —
   matching exactly this shape:

${EXERCISE_JSON_SCHEMA_DESCRIPTION}`

async function callGemini(messages: any[]): Promise<ExerciseContent> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      temperature: 0.4,
      messages,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Gemini request failed: ${response.status} ${response.statusText} — ${errorBody}`)
  }

  const data = await response.json()
  const rawText: string = data.choices?.[0]?.message?.content ?? ''
  const cleaned = rawText.replace(/```json|```/g, '').trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI response was not valid JSON.')
  }
  if (!isValidExerciseContent(parsed)) {
    throw new Error('AI response was missing required exercise fields.')
  }
  return parsed
}

export async function generateExerciseFromText(
  extractedText: string,
  questionCount: number
): Promise<ExerciseContent> {
  const userPrompt = `Generate ${questionCount} questions based on this content:\n\n${extractedText.slice(0, 12000)}`
  // WHY the slice: extremely long documents (a full textbook chapter) can
  // exceed reasonable prompt size — capping at ~12000 characters keeps the
  // request fast and affordable while still covering a full page or two of
  // real content, which is what this feature is actually meant for.

  const MAX_ATTEMPTS = 2
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGemini([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ])
    } catch (err) {
      lastError = err as Error
      console.warn(`generateExerciseFromText attempt ${attempt} failed:`, lastError.message)
    }
  }
  throw lastError ?? new Error('Exercise generation from text failed after retries.')
}

export async function generateExerciseFromImage(
  imageDataUrl: string,
  questionCount: number
): Promise<ExerciseContent> {
  const userPrompt = `Generate ${questionCount} questions based on the content in this image.`

  const MAX_ATTEMPTS = 2
  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callGemini([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ])
    } catch (err) {
      lastError = err as Error
      console.warn(`generateExerciseFromImage attempt ${attempt} failed:`, lastError.message)
    }
  }
  throw lastError ?? new Error('Exercise generation from image failed after retries.')
}
