// Purpose: Converts a generated exam (ExamContent, the structured
// question data) plus the teacher's school branding into a starting
// Tiptap/ProseMirror document — the "engine" that automatically builds the
// school name + logo letterhead and lays out every question, so a teacher
// opening the Word Processor for the first time sees a real, print-shaped
// exam paper ready to fine-tune, not a blank page they'd have to retype
// everything into.
// Folder: lib/tiptap/examToDocumentJson.ts
// Depends on: @tiptap/core (only for the JSONContent type)

import type { JSONContent } from '@tiptap/core'
import type { ExamContent } from '@/lib/ai/examSchema'

export interface ExamDocumentBranding {
  schoolName: string | null
  schoolLogoUrl: string | null
}

export interface ExamDocumentMeta {
  subjectName: string
  classLevel: string
}

// Plain text run, using the document's default font (Times New Roman,
// 12pt — set once via CSS on the editor container, see
// components/document-editor/DocumentEditor.tsx) unless marks are given.
function run(text: string, marks: JSONContent['marks'] = undefined): JSONContent {
  return marks ? { type: 'text', text, marks } : { type: 'text', text }
}

function centeredParagraph(children: JSONContent[]): JSONContent {
  return { type: 'paragraph', attrs: { textAlign: 'center' }, content: children }
}

function paragraph(children: JSONContent[]): JSONContent {
  return { type: 'paragraph', content: children }
}

function emptyParagraph(): JSONContent {
  return { type: 'paragraph' }
}

export function buildExamDocumentJson(
  content: ExamContent,
  meta: ExamDocumentMeta,
  branding: ExamDocumentBranding,
  includeAnswerKey: boolean
): JSONContent {
  const nodes: JSONContent[] = []

  // ---- Letterhead: school logo + name, auto-built from the teacher's
  // profile (Profile > School logo) — this is the "engine" the feature
  // request asked for, so a teacher never has to manually re-insert their
  // school's branding on every exam.
  if (branding.schoolLogoUrl) {
    nodes.push(
      centeredParagraph([
        {
          type: 'image',
          attrs: { src: branding.schoolLogoUrl, alt: 'School logo', width: '110px' },
        },
      ])
    )
  }
  if (branding.schoolName) {
    nodes.push(
      centeredParagraph([
        run(branding.schoolName.toUpperCase(), [
          { type: 'bold' },
          { type: 'textStyle', attrs: { fontSize: '16pt' } },
        ]),
      ])
    )
  }

  nodes.push(
    centeredParagraph([
      run(content.title.toUpperCase(), [{ type: 'bold' }, { type: 'textStyle', attrs: { fontSize: '14pt' } }]),
    ]),
    centeredParagraph([run(`${meta.subjectName} — ${meta.classLevel}`)]),
    centeredParagraph([
      run(`Time Allowed: ${content.duration_minutes} minutes        Total Marks: ${content.total_marks}`),
    ]),
    emptyParagraph(),
    paragraph([run(content.instructions, [{ type: 'italic' }])]),
    emptyParagraph(),
    { type: 'heading', attrs: { level: 2 }, content: [run('SECTION A — OBJECTIVE TEST')] }
  )

  content.objective_questions.forEach((q, i) => {
    nodes.push(
      paragraph([
        run(`${i + 1}. `, [{ type: 'bold' }]),
        run(q.question_text),
        run(`  (${q.marks} mark${q.marks > 1 ? 's' : ''})`, [{ type: 'italic' }]),
      ]),
      paragraph([
        run(
          q.options.map((opt, j) => `${String.fromCharCode(65 + j)}. ${opt}`).join('        ')
        ),
      ])
    )
  })

  nodes.push(
    emptyParagraph(),
    { type: 'heading', attrs: { level: 2 }, content: [run('SECTION B — THEORY')] },
    paragraph([run('Answer all questions.', [{ type: 'italic' }])])
  )

  content.theory_questions.forEach((q, i) => {
    nodes.push(
      paragraph([
        run(`${i + 1}. `, [{ type: 'bold' }]),
        run(q.question_text),
        run(`  (${q.marks} marks)`, [{ type: 'italic' }]),
      ]),
      // Blank ruled space for the student's written answer — a horizontal
      // rule under a couple of empty lines, matching the printed layout
      // teachers already expect (see the uploaded reference exams).
      emptyParagraph(),
      emptyParagraph(),
      { type: 'horizontalRule' }
    )
  })

  if (includeAnswerKey) {
    nodes.push(
      { type: 'pageBreak' },
      { type: 'heading', attrs: { level: 2 }, content: [run('ANSWER KEY — FOR TEACHER USE ONLY')] },
      { type: 'heading', attrs: { level: 3 }, content: [run('Section A — Objective')] },
      paragraph([run(content.objective_questions.map((q, i) => `${i + 1}. ${q.correct_answer}`).join('        '))]),
      { type: 'heading', attrs: { level: 3 }, content: [run('Section B — Theory (marking notes)')] },
      ...content.theory_questions.map((q, i) => paragraph([run(`${i + 1}. ${q.marking_notes}`)]))
    )
  }

  return { type: 'doc', content: nodes }
}

// Testing steps:
// 1. As a Premium teacher with a school name and logo saved in Profile,
//    open the Word Processor for any generated exam for the first time.
//    Expected: the logo and school name appear centered at the top,
//    followed by the exam title/subject/class/time/marks block, then
//    every objective and theory question, all in Times New Roman 12pt
//    except the school name/title (slightly larger, bold).
// 2. As a teacher with no logo saved, open the Word Processor. Expected:
//    the document starts directly with the school name (if set) or the
//    exam title — no broken image, no empty gap.
// 3. Toggle "include answer key" before first opening — expected: a page
//    break followed by the answer key section appears at the end.
