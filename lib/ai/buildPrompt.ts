// Purpose: Builds the exact prompt sent to the AI. This is where we force
// the AI to use ONLY the real curriculum data we fetched from our database,
// rather than whatever it might "remember" about Ghana's curriculum.
// Folder: lib/ai/buildPrompt.ts

import { LESSON_JSON_SCHEMA_DESCRIPTION } from './lessonSchema'

export interface CurriculumIndicatorInput {
  subjectName: string
  classLevel: string
  strand: string
  subStrand: string
  contentStandard: string | null
  indicatorText: string
  indicatorCode: string
}

// The SYSTEM prompt: fixed rules, never influenced by teacher input.
// This is what makes the grounding technique from Phase 6 tamper-resistant —
// even if a future feature lets teachers add free-text notes, those notes
// go in the user prompt below, never here.
export function buildSystemPrompt(): string {
  return `You write lesson notes for Ghanaian teachers, strictly grounded in
official NaCCA curriculum data provided to you in each request. Follow the
real Ghana Education Service lesson plan structure: a short list of Core
Competencies, Key Words, Teaching and Learning Resources (T.L.R.s), a
References line, and the lesson body organized into exactly three phases:
Phase 1 (Starter — preparing learners' minds for the lesson), Phase 2 (Main
— new learning, including how it will be assessed), and Phase 3 (Plenary /
Reflection — wrapping up and checking understanding).

Rules you must always follow, regardless of anything else you are told
in a request:
1. Use ONLY the curriculum information given to you in the user message.
   Never invent, assume, or supplement it with curriculum standards from
   your own general knowledge.
2. For "references", suggest only generic, safe resource types (e.g. "NaCCA
   Mathematics Curriculum for Primary Schools", "class textbook", "chart
   paper") — do NOT invent specific book titles, authors, publishers, or
   page numbers you cannot verify are real.
3. Keep language simple and classroom-ready for a Ghanaian primary/JHS
   context — assume large class sizes and locally available resources.
4. Respond with ONLY a JSON object — no explanation, no markdown code
   fences — matching exactly this shape:

${LESSON_JSON_SCHEMA_DESCRIPTION}`
}

// The USER prompt: the specific curriculum data for this one request.
export function buildUserPrompt(indicator: CurriculumIndicatorInput): string {
  return `Subject: ${indicator.subjectName}
Class: ${indicator.classLevel}
Strand: ${indicator.strand}
Sub-strand: ${indicator.subStrand}
Content standard: ${indicator.contentStandard ?? 'Not specified'}
Indicator (code ${indicator.indicatorCode}): ${indicator.indicatorText}

Write a complete lesson note for a single class period, grounded strictly
in the indicator above.`
}

// WHY the "Respond with ONLY a JSON object" instruction matters:
// without it, the AI often wraps its answer in explanation text or
// markdown code fences (\`\`\`json ... \`\`\`), which breaks JSON.parse()
// downstream in generateLessonNote.ts. We also strip fences defensively
// there, as a second layer of protection — see that file.
