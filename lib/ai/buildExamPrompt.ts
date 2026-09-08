// Purpose: Builds the prompt for exam generation. Supports two sources:
// 1. LESSONS — grounded in the real content of lessons the teacher has
//    already generated (the original Phase 16 design).
// 2. CURRICULUM — grounded directly in selected curriculum indicators, so a
//    teacher can generate a standard exam for a grade WITHOUT needing to
//    have generated lessons first. This is what makes it possible to set a
//    "standard question paper for each grade" straight from the curriculum
//    list, same as the Lesson Generator's own indicator picker.
// Folder: lib/ai/buildExamPrompt.ts

import { buildExamJsonSchemaDescription, type ExamStructure } from './examSchema'
import type { LessonNoteContent } from './lessonSchema'

export interface LessonSourceInput {
  indicatorText: string
  strand: string
  subStrand: string
  content: LessonNoteContent
}

// A curriculum-sourced exam has no lesson body to draw on — only the
// official indicator text itself (and content standard, when set). The
// AI is asked to write a standard set of questions that would fairly test
// that indicator for the grade, the same way a real exam board would set
// a paper straight from a syllabus, not from any one teacher's notes.
export interface CurriculumSourceInput {
  indicatorText: string
  strand: string
  subStrand: string
  contentStandard: string | null
  indicatorCode: string
}

const SHARED_RULES = (structure: ExamStructure) => `
1. You MUST produce EXACTLY ${structure.objectiveCount} objective (multiple choice)
   questions, each worth ${structure.marksPerObjective} mark(s), and EXACTLY
   ${structure.theoryCount} theory questions, each worth ${structure.marksPerTheory} marks.
   Total marks must equal ${structure.totalMarks}.
2. Each objective question needs exactly 4 answer options (A-D), only one
   correct.
3. Vary difficulty across the paper — not every question should be simple
   recall. Include a mix of recall, application, and higher-order questions.
4. Keep language age-appropriate for the class level given.
5. Respond with ONLY a JSON object — no explanation, no markdown fences —
   matching exactly this shape:

${buildExamJsonSchemaDescription(structure)}`

export function buildExamSystemPrompt(structure: ExamStructure): string {
  return `You write full, ready-to-print exam papers for Ghanaian teachers,
grounded strictly in the real lesson content provided to you.

Rules you must always follow:
1. Base every question ONLY on the topics, facts, and content given to you
   in the user message — do not introduce outside topics not covered by
   the provided lessons.
${SHARED_RULES(structure)}`
}

// WHY a distinct system prompt for curriculum-sourced exams rather than
// reusing the lesson one verbatim: the grounding source is different (an
// official indicator description, not a full written lesson), so the
// instruction has to tell the AI to write a STANDARD paper for that topic
// at that grade — testing everything a competent student should know
// from the indicator, not just facts literally spelled out in one
// teacher's lesson text.
export function buildCurriculumExamSystemPrompt(structure: ExamStructure): string {
  return `You write full, ready-to-print STANDARD exam papers for Ghanaian
teachers, built directly from official NaCCA curriculum indicators for a
grade — the same way a real exam board (e.g. WAEC/BECE-style) would set a
paper straight from the syllabus, before any individual teacher's lesson
notes exist.

Rules you must always follow:
1. Base every question ONLY on what a student who has been correctly taught
   the given curriculum indicator(s) should know — cover the full breadth of
   each indicator and its content standard, not just one narrow angle.
2. Do not introduce topics outside the strands/sub-strands/indicators given.
${SHARED_RULES(structure)}`
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

export function buildCurriculumExamUserPrompt(
  subjectName: string,
  classLevel: string,
  indicators: CurriculumSourceInput[]
): string {
  const indicatorSummaries = indicators
    .map((ind, i) => {
      return `Indicator ${i + 1} (${ind.indicatorCode}) — ${ind.strand} / ${ind.subStrand}
Performance indicator: ${ind.indicatorText}
Content standard: ${ind.contentStandard ?? '—'}`
    })
    .join('\n\n')

  return `Subject: ${subjectName}
Class: ${classLevel}

Build a standard exam covering these ${indicators.length} curriculum indicator(s):

${indicatorSummaries}`
}
