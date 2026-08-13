// Purpose: Defines the structure of a generated assessment.
// Folder: lib/ai/assessmentSchema.ts

export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'essay'
  | 'fill_in_blank'
  | 'matching'

// One entry per Bloom's Taxonomy level — WHY we tag each question with this:
// it lets a teacher (or a future report) see at a glance whether an
// assessment is all "remember/recall" questions or genuinely tests deeper
// understanding, and it's a direct, checkable signal of assessment quality.
export type BloomLevel =
  | 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create'

export interface AssessmentQuestion {
  type: QuestionType
  bloom_level: BloomLevel
  question_text: string
  options?: string[]       // used for multiple_choice and matching
  correct_answer: string
  marks: number
}

export interface AssessmentContent {
  title: string
  instructions: string
  questions: AssessmentQuestion[]
  marking_scheme: string   // how marks are awarded overall
  rubric?: string          // present when the assessment includes an essay/short answer
}

export const ASSESSMENT_JSON_SCHEMA_DESCRIPTION = `{
  "title": "string",
  "instructions": "string",
  "questions": [
    {
      "type": "multiple_choice" | "true_false" | "short_answer" | "essay" | "fill_in_blank" | "matching",
      "bloom_level": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
      "question_text": "string",
      "options": ["string", ...] (only for multiple_choice or matching),
      "correct_answer": "string",
      "marks": number
    }
  ],
  "marking_scheme": "string",
  "rubric": "string (optional)"
}`

export function isValidAssessment(value: unknown): value is AssessmentContent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.title === 'string' &&
    typeof v.instructions === 'string' &&
    Array.isArray(v.questions) &&
    v.questions.length > 0 &&
    typeof v.marking_scheme === 'string'
  )
}
