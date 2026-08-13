// Purpose: Defines the structure of a generated exam, and the logic for
// which question-count/marks structure applies to which class level.
// Folder: lib/ai/examSchema.ts

import { getClassBand, type ClassBand } from '@/lib/curriculum/bands'

export type ExamBand = ClassBand

export interface ExamStructure {
  band: ExamBand
  label: string
  objectiveCount: number
  marksPerObjective: number
  theoryCount: number
  marksPerTheory: number
  totalMarks: number
}

// WHY these three fixed structures, not a configurable form: consistent,
// predictable exam formats are the whole point here — a teacher shouldn't
// have to decide "how many questions" every time, any more than a real
// exam board would let that vary paper to paper.
export const EXAM_STRUCTURES: Record<ExamBand, ExamStructure> = {
  lower_primary: {
    band: 'lower_primary',
    label: 'Basic 1–3',
    objectiveCount: 20,
    marksPerObjective: 3,
    theoryCount: 8,
    marksPerTheory: 5,
    totalMarks: 100,
  },
  upper_primary: {
    band: 'upper_primary',
    label: 'Basic 4–6',
    objectiveCount: 30,
    marksPerObjective: 2,
    theoryCount: 8,
    marksPerTheory: 5,
    totalMarks: 100,
  },
  jhs: {
    band: 'jhs',
    label: 'JHS 1–3 (BECE standard)',
    objectiveCount: 40,
    marksPerObjective: 1,
    theoryCount: 5,
    marksPerTheory: 12,
    totalMarks: 100,
  },
}

// WHY this lives here as a re-export: existing code across the app already
// imports getExamBand from this file — this keeps that working while the
// real logic lives in one shared place (lib/curriculum/bands.ts).
export const getExamBand = getClassBand

export interface ObjectiveQuestion {
  question_text: string
  options: string[] // exactly 4 options
  correct_answer: string // the letter, e.g. "B"
  marks: number
}

export interface TheoryQuestion {
  question_text: string
  marks: number
  marking_notes: string // brief guidance for the teacher marking it
}

export interface ExamContent {
  title: string
  instructions: string
  duration_minutes: number
  objective_questions: ObjectiveQuestion[]
  theory_questions: TheoryQuestion[]
  total_marks: number
}

export function buildExamJsonSchemaDescription(structure: ExamStructure): string {
  return `{
  "title": "string",
  "instructions": "string",
  "duration_minutes": number,
  "objective_questions": [
    // EXACTLY ${structure.objectiveCount} items
    { "question_text": "string", "options": ["string","string","string","string"], "correct_answer": "A" | "B" | "C" | "D", "marks": ${structure.marksPerObjective} }
  ],
  "theory_questions": [
    // EXACTLY ${structure.theoryCount} items
    { "question_text": "string", "marks": ${structure.marksPerTheory}, "marking_notes": "string" }
  ],
  "total_marks": ${structure.totalMarks}
}`
}

export function isValidExamContent(value: unknown, structure: ExamStructure): value is ExamContent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.title !== 'string' || typeof v.instructions !== 'string') return false
  if (!Array.isArray(v.objective_questions) || v.objective_questions.length !== structure.objectiveCount) return false
  if (!Array.isArray(v.theory_questions) || v.theory_questions.length !== structure.theoryCount) return false
  return true
}
