// Purpose: Defines the structure of a generated exercise/homework set —
// more flexible than the fixed-structure Exam Generator, since this is
// built from arbitrary teacher-uploaded content, not a rigid exam format.
// Folder: lib/ai/exerciseSchema.ts

export type ExerciseQuestionType = 'objective' | 'short_answer' | 'essay'

export interface ExerciseQuestion {
  question_text: string
  question_type: ExerciseQuestionType
  options: string[] | null // populated only for 'objective'
  correct_answer: string   // the letter for objective, or a model answer otherwise
  marks: number
}

export interface ExerciseContent {
  title: string
  instructions: string
  questions: ExerciseQuestion[]
  marking_scheme: string
  total_marks: number
}

export const EXERCISE_JSON_SCHEMA_DESCRIPTION = `{
  "title": "string",
  "instructions": "string",
  "questions": [
    {
      "question_text": "string",
      "question_type": "objective" | "short_answer" | "essay",
      "options": ["string","string","string","string"] | null,
      "correct_answer": "string",
      "marks": number
    }
  ],
  "marking_scheme": "string",
  "total_marks": number
}`

export function isValidExerciseContent(value: unknown): value is ExerciseContent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.title === 'string' &&
    Array.isArray(v.questions) &&
    v.questions.length > 0 &&
    typeof v.marking_scheme === 'string'
  )
}
