// Purpose: Builds a downloadable Word (.docx) document of a lesson note,
// matching the same real Ghana Education Service lesson plan layout as
// the PDF export — header logistics, curriculum data, and the three
// teaching phases. Runs entirely in the browser via the `docx` library —
// no server call, no API key. This is a PREMIUM-only feature; the gating
// happens in the editor UI (app/lesson/[id]/editor.tsx), not here — this
// file only builds the document once called.
// Folder: lib/word/generateLessonWord.ts
// Depends on: docx
'use client'

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType,
} from 'docx'
import type { LessonNoteContent } from '@/lib/ai/lessonSchema'

export interface LessonWordMeta {
  subjectName: string
  classLevel: string
  strand: string
  subStrand: string
  contentStandard: string | null
  indicatorText: string
  indicatorCode: string
}

function labelValueRow(pairs: [string, string][]): TableRow {
  return new TableRow({
    children: pairs.map(([label, value]) =>
      new TableCell({
        width: { size: 100 / pairs.length, type: WidthType.PERCENTAGE },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: `${label}: `, bold: true, size: 20 }),
              new TextRun({ text: value || '________', size: 20 }),
            ],
          }),
        ],
      })
    ),
  })
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 } })
}

function bodyText(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: text || '—', size: 22 })], spacing: { after: 120 } })
}

function bulletList(items: string[]): Paragraph[] {
  if (items.length === 0) return [bodyText('—')]
  return items.map((item) => new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 40 } }))
}

export async function generateLessonWord(meta: LessonWordMeta, content: LessonNoteContent) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'LESSON PLAN',
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              labelValueRow([
                ['Week', content.week_number], ['Subject', meta.subjectName], ['Class', meta.classLevel],
              ]),
              labelValueRow([
                ['Week Ending', content.week_ending], ['Class Size', content.class_size],
              ]),
              labelValueRow([
                ['Day(s)', content.days], ['Date', content.date],
                ['Period', content.period], ['Lesson', content.lesson_number],
              ]),
            ],
          }),

          sectionHeading('Strand'),
          bodyText(meta.strand),
          sectionHeading('Sub-strand'),
          bodyText(meta.subStrand),
          sectionHeading('Indicator (code) / Content standard'),
          bodyText(`${meta.indicatorCode}  —  ${meta.contentStandard ?? '—'}`),
          sectionHeading('Performance Indicator'),
          bodyText(meta.indicatorText),

          sectionHeading('Core Competencies'),
          ...bulletList(content.core_competencies),
          sectionHeading('Key Words'),
          bodyText(content.key_words.join(', ')),
          sectionHeading('T.L.R(s)'),
          ...bulletList(content.tlrs),
          sectionHeading('Ref'),
          bodyText(content.references),

          sectionHeading('Phase 1: Starter (preparing the brain for learning)'),
          bodyText(content.phase1_starter),
          sectionHeading('Phase 2: Main (new learning, including assessment)'),
          bodyText(content.phase2_main),
          sectionHeading('Phase 3: Plenary / Reflections'),
          bodyText(content.phase3_plenary),

          new Paragraph({ text: '', spacing: { before: 400 } }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Vetted by: _____________________     ', size: 20 }),
              new TextRun({ text: 'Signature: _____________     ', size: 20 }),
              new TextRun({ text: 'Date: __________', size: 20 }),
            ],
          }),
        ],
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'lesson-plan.docx'
  link.click()
  URL.revokeObjectURL(url)
}

// Testing steps:
// 1. As a Premium teacher, open a lesson, click "Download as Word."
// 2. Expected: a file named lesson-plan.docx downloads, opens correctly
//    in Microsoft Word or Google Docs, and is fully editable — the whole
//    point of Word export over PDF is that a teacher can keep tweaking it.
// 3. Confirm all header fields, curriculum data, and the three phases
//    appear, matching what's on screen in the editor.
