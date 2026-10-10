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
import { geminiJson, GeminiError } from './gemini'
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
      if (err instanceof GeminiError && ['auth', 'no_key', 'quota'].includes(err.kind)) break
    }
  }

  throw lastError ?? new Error('Assessment generation failed after retries.')
}

async function callModelOnce(
  indicator: CurriculumIndicatorInput,
  options: AssessmentRequestOptions
): Promise<AssessmentContent> {
  const parsed = await geminiJson({
    messages: [
      { role: 'system', content: buildAssessmentSystemPrompt() },
      { role: 'user', content: buildAssessmentUserPrompt(indicator, options) },
    ],
  })

  if (!isValidAssessment(parsed)) {
    throw new GeminiError('invalid_shape', 'AI response was missing required assessment fields.')
  }
  return parsed
}
