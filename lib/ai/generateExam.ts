// Purpose: Calls the AI to generate a full exam, validates the response
// against the exact required structure (question counts, marks) for the
// class band, and retries once on failure. Supports both generation paths:
// from a teacher's own lessons, or a standard exam straight from selected
// curriculum indicators.
// Folder: lib/ai/generateExam.ts

import {
  buildExamSystemPrompt,
  buildExamUserPrompt,
  buildCurriculumExamSystemPrompt,
  buildCurriculumExamUserPrompt,
  type LessonSourceInput,
  type CurriculumSourceInput,
} from './buildExamPrompt'
import { isValidExamContent, type ExamContent, type ExamStructure } from './examSchema'

const MAX_ATTEMPTS = 2

export async function generateExam(
  subjectName: string,
  classLevel: string,
  lessons: LessonSourceInput[],
  structure: ExamStructure
): Promise<ExamContent> {
  return runWithRetries(() =>
    callModel(
      buildExamSystemPrompt(structure),
      buildExamUserPrompt(subjectName, classLevel, lessons),
      structure
    )
  )
}

// WHY a separate exported function rather than a boolean flag on
// generateExam: the two paths take different input shapes (lessons vs.
// curriculum indicators) and build different prompts — a shared signature
// would need optional/union params for both, which is harder to call
// correctly than two small, explicit functions.
export async function generateExamFromCurriculum(
  subjectName: string,
  classLevel: string,
  indicators: CurriculumSourceInput[],
  structure: ExamStructure
): Promise<ExamContent> {
  return runWithRetries(() =>
    callModel(
      buildCurriculumExamSystemPrompt(structure),
      buildCurriculumExamUserPrompt(subjectName, classLevel, indicators),
      structure
    )
  )
}

async function runWithRetries(attempt: () => Promise<ExamContent>): Promise<ExamContent> {
  let lastError: Error | null = null
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      return await attempt()
    } catch (err) {
      lastError = err as Error
      console.warn(`Exam generation attempt ${i} failed:`, lastError.message)
    }
  }
  throw lastError ?? new Error('Exam generation failed after retries.')
}

async function callModel(
  systemPrompt: string,
  userPrompt: string,
  structure: ExamStructure
): Promise<ExamContent> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gemini-3.6-flash',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
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

  // WHY we validate against the EXACT structure, not just "is this an
  // exam-shaped object": a paper with 27 objective questions instead of 30
  // would silently produce a wrong-total-marks exam a teacher might not
  // notice until printing it for real students. Strict validation here
  // means a structural mismatch gets caught and retried, not shipped.
  if (!isValidExamContent(parsed, structure)) {
    throw new Error(
      `AI response did not match the required structure (expected ${structure.objectiveCount} objective + ${structure.theoryCount} theory questions).`
    )
  }

  return parsed
}
