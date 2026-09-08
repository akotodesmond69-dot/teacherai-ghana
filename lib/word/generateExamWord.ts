// Purpose: Builds a downloadable Word (.docx) document of a generated
// exam — the same content and structure as the PDF export, but fully
// editable once downloaded (a teacher may want to tweak wording further
// in Word itself, or merge it into a school letterhead template). Runs
// entirely in the browser via the `docx` library — no server call, no API
// key. Premium-only; gating happens in the caller
// (app/exam/[id]/exam-view.tsx), not here.
// Folder: lib/word/generateExamWord.ts
// Depends on: docx
'use client'

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
} from 'docx'
import type { ExamContent } from '@/lib/ai/examSchema'

export interface ExamWordMeta {
  subjectName: string
  classLevel: string
}

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_3): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } })
}

function body(text: string, size = 22, spacingAfter = 100): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: text || '—', size })], spacing: { after: spacingAfter } })
}

export async function generateExamWord(meta: ExamWordMeta, content: ExamContent, includeAnswerKey: boolean) {
  const objectiveParagraphs: Paragraph[] = []
  content.objective_questions.forEach((q, i) => {
    objectiveParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 22 }),
          new TextRun({ text: q.question_text, size: 22 }),
          new TextRun({ text: `  (${q.marks} mark${q.marks > 1 ? 's' : ''})`, italics: true, size: 20 }),
        ],
        spacing: { after: 40 },
      })
    )
    const optionsText = q.options.map((opt, j) => `${String.fromCharCode(65 + j)}. ${opt}`).join('     ')
    objectiveParagraphs.push(body(optionsText, 22, 140))
  })

  const theoryParagraphs: Paragraph[] = []
  content.theory_questions.forEach((q, i) => {
    theoryParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 22 }),
          new TextRun({ text: q.question_text, size: 22 }),
          new TextRun({ text: `  (${q.marks} marks)`, italics: true, size: 20 }),
        ],
        spacing: { after: 40 },
      })
    )
    // Blank ruled space for the printed/student copy — an empty paragraph
    // with bottom border, same trick used for signature lines elsewhere.
    theoryParagraphs.push(
      new Paragraph({
        text: '',
        border: { bottom: { color: 'auto', space: 1, style: 'single', size: 6 } },
        spacing: { after: 200 },
      })
    )
  })

  const answerKeySection: Paragraph[] = []
  if (includeAnswerKey) {
    answerKeySection.push(
      new Paragraph({ text: '', pageBreakBefore: true }),
      heading('ANSWER KEY — FOR TEACHER USE ONLY', HeadingLevel.HEADING_2),
      heading('Section A — Objective'),
      body(content.objective_questions.map((q, i) => `${i + 1}. ${q.correct_answer}`).join('    ')),
      heading('Section B — Theory (marking notes)'),
      ...content.theory_questions.map((q, i) => body(`${i + 1}. ${q.marking_notes}`, 22, 120))
    )
  }

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: content.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `${meta.subjectName} — ${meta.classLevel}`, size: 22 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Time Allowed: ${content.duration_minutes} minutes`, size: 20 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Total Marks: ${content.total_marks}`, size: 20 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: content.instructions, italics: true, size: 20 })],
            spacing: { after: 200 },
          }),

          heading('SECTION A — OBJECTIVE TEST', HeadingLevel.HEADING_2),
          ...objectiveParagraphs,

          heading('SECTION B — THEORY', HeadingLevel.HEADING_2),
          body('Answer all questions.', 18, 160),
          ...theoryParagraphs,

          ...answerKeySection,
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${slugify(content.title)}.docx`
  link.click()
  URL.revokeObjectURL(url)
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'exam'
}

// Testing steps:
// 1. On a generated/edited exam, click "Download as Word" with the answer
//    key toggle OFF. Expected: a .docx opens correctly in Word/Google Docs
//    with Section A (numbered questions + lettered options) and Section B
//    (numbered questions + a blank ruled line each), no answers shown.
// 2. Toggle the answer key ON and download again. Expected: an extra page
//    (real page break) with objective answer letters and theory marking
//    notes.
// 3. Confirm the exported document is fully editable in Word — the whole
//    point of Word export over PDF, same as the Lesson Generator's.
