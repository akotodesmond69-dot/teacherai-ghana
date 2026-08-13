// Purpose: Builds the prompt for exam generation, grounded in the real
// content of lessons the teacher has already generated (not raw curriculum
// data directly — see the Phase 16 design note on why).
// Folder: lib/ai/buildExamPrompt.ts

import { buildExamJsonSchemaDescription, type ExamStructure } from './examSchema'
import type { LessonNoteContent } from './lessonSchema'

export interface LessonSourceInput {
  indicatorText: string
  strand: string
  subStrand: string
  content: LessonNoteContent
}

export function buildExamSystemPrompt(structure: ExamStructure): string {
  return `You write full, ready-to-print exam papers for Ghanaian teachers,
grounded strictly in the real lesson content provided to you.

Rules you must always follow:
1. Base every question ONLY on the topics, facts, and content given to you
   in the user message — do not introduce outside topics not covered by
   the provided lessons.
2. You MUST produce EXACTLY ${structure.objectiveCount} objective (multiple choice)
   questions, each worth ${structure.marksPerObjective} mark(s), and EXACTLY
   ${structure.theoryCount} theory questions, each worth ${structure.marksPerTheory} marks.
   Total marks must equal ${structure.totalMarks}.
3. Each objective question needs exactly 4 answer options (A-D), only one
   correct.
4. Vary difficulty across the paper — not every question should be simple
   recall.
5. Keep language age-appropriate for the class level given.
6. Respond with ONLY a JSON object — no explanation, no markdown fences —
   matching exactly this shape:

${buildExamJsonSchemaDescription(structure)}`
}

export function buildExamUserPrompt(
  subjectName: string,
  classLevel: string,
  lessons: LessonSourceInput[]
): string {
  const lessonSummaries = lessons
    .map((lesson, i) => {
      const c = lesson.content
      return `Lesson ${i + 1} — ${lesson.strand} / ${lesson.subStrand}: ${lesson.indicatorText}
Key words: ${c.key_words.join(', ')}
Core competencies: ${c.core_competencies.join(', ')}
Main teaching content: ${c.phase2_main}`
    })
    .join('\n\n')

  return `Subject: ${subjectName}
Class: ${classLevel}

Build the exam using ONLY the content from these ${lessons.length} lesson(s):

${lessonSummaries}`
}
