// Purpose: Builds the system + user prompts for assessment generation.
// Folder: lib/ai/buildAssessmentPrompt.ts
// Same grounding pattern as buildPrompt.ts (Phase 6/7): the AI only ever
// uses curriculum text we give it, never its own assumptions.

import { ASSESSMENT_JSON_SCHEMA_DESCRIPTION, type QuestionType } from './assessmentSchema'
import type { CurriculumIndicatorInput } from './buildPrompt'

export function buildAssessmentSystemPrompt(): string {
  return `You write classroom assessments for Ghanaian teachers, strictly
grounded in official NaCCA curriculum data provided in each request.

Rules you must always follow:
1. Use ONLY the curriculum information given to you in the user message.
2. Vary the Bloom's Taxonomy level across questions — do not make every
   question a simple recall question.
3. Keep language simple and appropriate for the stated class level.
4. Respond with ONLY a JSON object — no explanation, no markdown code
   fences — matching exactly this shape:

${ASSESSMENT_JSON_SCHEMA_DESCRIPTION}`
}

export interface AssessmentRequestOptions {
  questionTypes: QuestionType[]
  numQuestions: number
}

export function buildAssessmentUserPrompt(
  indicator: CurriculumIndicatorInput,
  options: AssessmentRequestOptions
): string {
  return `Subject: ${indicator.subjectName}
Class: ${indicator.classLevel}
Strand: ${indicator.strand}
Sub-strand: ${indicator.subStrand}
Content standard: ${indicator.contentStandard ?? 'Not specified'}
Indicator (code ${indicator.indicatorCode}): ${indicator.indicatorText}

Create an assessment with exactly ${options.numQuestions} questions, using
only these question types: ${options.questionTypes.join(', ')}.
Include a marking scheme, and a rubric if any essay or short-answer
questions are included.`
}
