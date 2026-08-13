// Purpose: Calls the AI to generate an assessment, validates the response.
// Folder: lib/ai/generateAssessment.ts
// Same structure as generateLessonNote.ts (Phase 6/7) — retry once on
// malformed response, validate before returning.

import {
  buildAssessmentSystemPrompt,
  buildAssessmentUserPrompt,
  type AssessmentRequestOptions,
} from './buildAssessmentPrompt'
import { isValidAssessment, type AssessmentContent } from './assessmentSchema'
import type { CurriculumIndicatorInput } from './buildPrompt'

export async function generateAssessment(
  indicator: CurriculumIndicatorInput,
  options: AssessmentRequestOptions
): Promise<AssessmentContent> {
  const MAX_ATTEMPTS = 2
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callModelOnce(indicator, options)
    } catch (err) {
      lastError = err as Error
      console.warn(`Assessment generation attempt ${attempt} failed:`, lastError.message)
    }
  }

  throw lastError ?? new Error('Assessment generation failed after retries.')
}

async function callModelOnce(
  indicator: CurriculumIndicatorInput,
  options: AssessmentRequestOptions
): Promise<AssessmentContent> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      temperature: 0.4, // slightly higher than lessons (0.3) — a bit more
                         // variety in question phrasing is fine here, since
                         // there's no single "correct" way to phrase a question
      messages: [
        { role: 'system', content: buildAssessmentSystemPrompt() },
        { role: 'user', content: buildAssessmentUserPrompt(indicator, options) },
      ],
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

  if (!isValidAssessment(parsed)) {
    throw new Error('AI response was missing required assessment fields.')
  }

  return parsed
}
