// Purpose: Calls the AI to generate a full exam, validates the response
// against the exact required structure (question counts, marks) for the
// class band, and retries once on failure. Supports both generation paths:
// from a teacher's own lessons, or a standard exam straight from selected
// curriculum indicators.
// Folder: lib/ai/generateExam.ts
//
// All AI traffic goes through ./gemini (model fallback, backoff, timeout).

import {
  buildExamSystemPrompt,
  buildExamUserPrompt,
  buildCurriculumExamSystemPrompt,
  buildCurriculumExamUserPrompt,
  type LessonSourceInput,
  type CurriculumSourceInput,
} from './buildExamPrompt'
import { type ExamContent, type ExamStructure } from './examSchema'
import { geminiJson, GeminiError } from './gemini'

const MAX_ATTEMPTS = 2

export async function generateExam(
  subjectName: string,
  classLevel: string,
  lessons: LessonSourceInput[],
  structure: ExamStructure
): Promise<ExamContent> {
  return runWithRetries(structure, (correction) =>
    callModelOnce(
      buildExamSystemPrompt(structure),
      buildExamUserPrompt(subjectName, classLevel, lessons) + correction,
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
  return runWithRetries(structure, (correction) =>
    callModelOnce(
      buildCurriculumExamSystemPrompt(structure),
      buildCurriculumExamUserPrompt(subjectName, classLevel, indicators) + correction,
      structure
    )
  )
}

async function runWithRetries(
  _structure: ExamStructure,
  attemptFn: (correction: string) => Promise<ExamContent>
): Promise<ExamContent> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      // On the second attempt, tell the model exactly what was wrong last
      // time (usually "39 questions instead of 40").
      const correction =
        attempt > 1 && lastError instanceof GeminiError && lastError.kind === 'invalid_shape'
          ? `\n\nIMPORTANT: your previous answer was rejected: ${lastError.message} Count carefully and return exactly the required number of questions.`
          : ''
      return await attemptFn(correction)
    } catch (err) {
      lastError = err as Error
      console.warn(`Exam generation attempt ${attempt} failed:`, lastError.message)
      // Bad key / exhausted quota will not fix itself on an immediate retry.
      if (err instanceof GeminiError && ['auth', 'no_key', 'quota'].includes(err.kind)) break
    }
  }

  throw lastError ?? new Error('Exam generation failed after retries.')
}

async function callModelOnce(
  systemPrompt: string,
  userPrompt: string,
  structure: ExamStructure
): Promise<ExamContent> {
  const parsed = await geminiJson({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  })

  return normaliseExam(parsed, structure)
}

// WHY we normalise instead of only rejecting: the structure (counts, marks
// per question, total) is FIXED per class band, so the code — not the model —
// is the source of truth for those numbers. Small slips that can be repaired
// deterministically are repaired (extra questions trimmed, marks and total
// reset to the real values, "B." -> "B"). Anything that cannot be repaired
// without inventing content (too FEW questions, wrong option count) is still
// rejected and retried, so a short paper is never shipped to a teacher.
function normaliseExam(value: unknown, structure: ExamStructure): ExamContent {
  const fail = (msg: string) => new GeminiError('invalid_shape', msg)

  if (typeof value !== 'object' || value === null) throw fail('Reply was not an exam object.')
  const v = value as Record<string, any>
  if (typeof v.title !== 'string' || typeof v.instructions !== 'string') {
    throw fail('Exam is missing a title or instructions.')
  }
  if (!Array.isArray(v.objective_questions) || v.objective_questions.length < structure.objectiveCount) {
    throw fail(
      `Expected ${structure.objectiveCount} objective questions but got ${Array.isArray(v.objective_questions) ? v.objective_questions.length : 0}.`
    )
  }
  if (!Array.isArray(v.theory_questions) || v.theory_questions.length < structure.theoryCount) {
    throw fail(
      `Expected ${structure.theoryCount} theory questions but got ${Array.isArray(v.theory_questions) ? v.theory_questions.length : 0}.`
    )
  }

  const objective = v.objective_questions.slice(0, structure.objectiveCount).map((q: any, i: number) => {
    const letter = String(q?.correct_answer ?? '').trim().charAt(0).toUpperCase()
    if (typeof q?.question_text !== 'string' || !Array.isArray(q?.options) || q.options.length !== 4) {
      throw fail(`Objective question ${i + 1} must have question_text and exactly 4 options.`)
    }
    if (!['A', 'B', 'C', 'D'].includes(letter)) {
      throw fail(`Objective question ${i + 1} has no valid correct_answer (A-D).`)
    }
    return {
      question_text: q.question_text,
      options: q.options.map(String),
      correct_answer: letter,
      marks: structure.marksPerObjective,
    }
  })

  const theory = v.theory_questions.slice(0, structure.theoryCount).map((q: any, i: number) => {
    if (typeof q?.question_text !== 'string') throw fail(`Theory question ${i + 1} is missing question_text.`)
    return {
      question_text: q.question_text,
      marks: structure.marksPerTheory,
      marking_notes: typeof q.marking_notes === 'string' ? q.marking_notes : '',
    }
  })

  return {
    title: v.title,
    instructions: v.instructions,
    duration_minutes: typeof v.duration_minutes === 'number' ? v.duration_minutes : 90,
    objective_questions: objective,
    theory_questions: theory,
    total_marks: structure.totalMarks,
  }
}
