// Purpose: Builds a downloadable Word (.docx) document of a lesson note,
// laid out as a real bordered table like the Ghana Education Service lesson
// plan book — header logistics, curriculum data, and the three teaching
// phases. Runs entirely in the browser via the `docx` library — no server
// call, no API key. This is a PREMIUM-only feature; the gating happens in
// the editor UI (app/lesson/[id]/editor.tsx), not here.
// Folder: lib/word/generateLessonWord.ts
// Depends on: docx
'use client'

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, TableLayoutType, ShadingType,
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

// ---------------------------------------------------------------------------
// Layout constants. WHY these exist: the old export gave cell widths as
// percentages, which Word renders unreliably (columns collapse and text gets
// clipped). A fixed layout with explicit widths in DXA (1/20 of a point)
// always renders the same in Word, Google Docs and LibreOffice.
// ---------------------------------------------------------------------------
const FONT = 'Arial'
const TABLE_FONT_SIZE = 24 // half-points → 12 pt. Every piece of text in the tables uses this.
const PAGE_WIDTH = 11906 // A4 in DXA
const MARGIN = 1080 // 0.75 inch
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2 // 9746
const LABEL_COL = 2400
const VALUE_COL = TABLE_WIDTH - LABEL_COL
const LABEL_FILL = 'EDEDED'

// 4-column layout for the header grid: label | value | label | value
const H_LABEL = 1700
const H_VALUE = (TABLE_WIDTH - H_LABEL * 2) / 2

function run(text: string, bold = false): TextRun {
  return new TextRun({ text, bold, size: TABLE_FONT_SIZE, font: FONT })
}

// WHY we split on newlines: a TextRun ignores "\n", so multi-step phases
// ("1. ... 2. ...") used to run together into one wall of text. One
// paragraph per line keeps the AI's own structure.
function linesToParagraphs(text: string, blankIfEmpty = false): Paragraph[] {
  const lines = (text || (blankIfEmpty ? '' : '—')).split(/\r?\n/).map((l) => l.trimEnd())
  const nonEmpty = lines.some((l) => l.trim() !== '')
  return (nonEmpty ? lines : [blankIfEmpty ? '' : '—']).map(
    (line) => new Paragraph({ children: [run(line)], spacing: { after: 80 } })
  )
}

function bulletParagraphs(items: string[]): Paragraph[] {
  const clean = items.map((i) => i.trim()).filter(Boolean)
  if (clean.length === 0) return [new Paragraph({ children: [run('—')] })]
  return clean.map(
    (item) =>
      new Paragraph({ children: [run(item)], bullet: { level: 0 }, spacing: { after: 60 } })
  )
}

function cell(
  children: Paragraph[],
  width: number,
  opts: { shaded?: boolean; columnSpan?: number } = {}
): TableCell {
  return new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    columnSpan: opts.columnSpan,
    shading: opts.shaded ? { type: ShadingType.CLEAR, color: 'auto', fill: LABEL_FILL } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  })
}

const labelCell = (text: string, width = LABEL_COL) =>
  cell([new Paragraph({ children: [run(text, true)] })], width, { shaded: true })

function detailRow(label: string, valueParas: Paragraph[]): TableRow {
  return new TableRow({ children: [labelCell(label), cell(valueParas, VALUE_COL)] })
}

function headerRow(l1: string, v1: string, l2?: string, v2?: string): TableRow {
  const cells: TableCell[] = [
    labelCell(l1, H_LABEL),
    cell(linesToParagraphs(v1, true), H_VALUE),
  ]
  if (l2 !== undefined) {
    cells.push(labelCell(l2, H_LABEL), cell(linesToParagraphs(v2 ?? '', true), H_VALUE))
  } else {
    // Last row has a single field — let its value span the rest of the row.
    cells[1] = cell(linesToParagraphs(v1, true), H_VALUE * 2 + H_LABEL, { columnSpan: 3 })
  }
  return new TableRow({ children: cells })
}

// Blank header fields (e.g. Week Ending) are left empty for the teacher to
// write in, like the paper plan book. Content is passed as-is.
export async function generateLessonWord(meta: LessonWordMeta, content: LessonNoteContent) {
  const headerTable = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [H_LABEL, H_VALUE, H_LABEL, H_VALUE],
    layout: TableLayoutType.FIXED,
    rows: [
      headerRow('Week', content.week_number, 'Subject', meta.subjectName),
      headerRow('Class', meta.classLevel, 'Class Size', content.class_size),
      headerRow('Week Ending', content.week_ending, 'Day(s)', content.days),
      headerRow('Date', content.date, 'Period', content.period),
      headerRow('Lesson', content.lesson_number),
    ],
  })

  const mainTable = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [LABEL_COL, VALUE_COL],
    layout: TableLayoutType.FIXED,
    rows: [
      detailRow('Strand', linesToParagraphs(meta.strand)),
      detailRow('Sub-strand', linesToParagraphs(meta.subStrand)),
      detailRow('Indicator (code)', linesToParagraphs(meta.indicatorCode)),
      detailRow('Content standard', linesToParagraphs(meta.contentStandard ?? '—')),
      detailRow('Performance indicator', linesToParagraphs(meta.indicatorText)),
      detailRow('Core Competencies', bulletParagraphs(content.core_competencies)),
      detailRow('Key Words', linesToParagraphs(content.key_words.join(', '))),
      detailRow('T.L.R(s)', bulletParagraphs(content.tlrs)),
      detailRow('Ref', linesToParagraphs(content.references)),
      detailRow('Phase 1: Starter (preparing the brain for learning)', linesToParagraphs(content.phase1_starter)),
      detailRow('Phase 2: Main (new learning, including assessment)', linesToParagraphs(content.phase2_main)),
      detailRow('Phase 3: Plenary / Reflections', linesToParagraphs(content.phase3_plenary)),
    ],
  })

  const doc = new Document({
    // Default font for anything not explicitly styled.
    styles: { default: { document: { run: { font: FONT, size: TABLE_FONT_SIZE } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'LESSON PLAN', bold: true, size: 32, font: FONT, color: '000000' })],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          headerTable,
          new Paragraph({ children: [], spacing: { after: 120 } }),
          mainTable,
          new Paragraph({ children: [], spacing: { before: 300 } }),
          new Paragraph({
            children: [
              run('Vetted by: _____________________     '),
              run('Signature: _____________     '),
              run('Date: __________'),
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
// 2. Expected: lesson-plan.docx opens with two bordered tables (a header
//    grid, then Strand → Phase 3), every cell in 12 pt Arial, nothing
//    clipped, multi-line phases showing one line per paragraph, and long
//    rows continuing onto the next page instead of being cut off.
