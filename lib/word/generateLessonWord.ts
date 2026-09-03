// Purpose: Builds a downloadable Word (.docx) document of a lesson note,
// laid out as a real bordered Ghana Education Service-style lesson-note
// table — a header logistics block (Week Ending/Day, Subject/Class,
// Strand/Sub-Strand, Content Standard, Indicator, Core Competencies, Key
// Words, References) followed by a bordered Phase / Learners' Activities
// / Resources grid — matching the PDF export and the paper lesson-note
// books teachers already use. Runs entirely in the browser via the `docx`
// library — no server call, no API key. This is a PREMIUM-only feature;
// the gating happens in the editor UI (app/lesson/[id]/editor.tsx), not
// here — this file only builds the document once called.
// Folder: lib/word/generateLessonWord.ts
// Depends on: docx
'use client'

import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
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
// Shared styling constants — one place to tweak font, border weight, or
// label colour so the header block and the phase grid always match.
// ---------------------------------------------------------------------------
const BODY_SIZE = 20 // 10pt (docx sizes are in half-points)
const LABEL_SIZE = 15 // 7.5pt
const LABEL_COLOR = '5A5A5A'
const CELL_MARGINS = { top: 80, bottom: 80, left: 110, right: 110 }

const LINE = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const TABLE_BORDERS = {
  top: LINE, bottom: LINE, left: LINE, right: LINE,
  insideHorizontal: LINE, insideVertical: LINE,
}

function listOrDash(items: string[]): string {
  return items.filter(Boolean).length ? items.filter(Boolean).join('  •  ') : '—'
}

function labelParagraph(label: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: label.toUpperCase(), bold: true, size: LABEL_SIZE, color: LABEL_COLOR })],
    spacing: { after: 40 },
  })
}

// Splits multi-line lesson-content text (Starter/Main/Plenary) into one
// paragraph per line so line breaks the teacher typed survive the export,
// instead of collapsing into a single unreadable block.
function bodyParagraphs(text: string): Paragraph[] {
  const lines = (text || '').split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return [new Paragraph({ children: [new TextRun({ text: '—', size: BODY_SIZE })] })]
  return lines.map(
    (line, i) =>
      new Paragraph({
        children: [new TextRun({ text: line, size: BODY_SIZE })],
        spacing: { after: i === lines.length - 1 ? 0 : 90 },
      })
  )
}

function bulletParagraphs(items: string[]): Paragraph[] {
  const clean = items.filter(Boolean)
  if (clean.length === 0) return [new Paragraph({ children: [new TextRun({ text: '—', size: BODY_SIZE })] })]
  return clean.map(
    (item) => new Paragraph({ text: item, bullet: { level: 0 }, spacing: { after: 40 } })
  )
}

// A field cell: small grey label on top, value(s) underneath — the same
// pattern used in the PDF export, so screen, PDF, and Word always agree.
function fieldCell(label: string, body: Paragraph[], opts: { widthPct?: number; columnSpan?: number } = {}): TableCell {
  return new TableCell({
    width: { size: opts.widthPct ?? 50, type: WidthType.PERCENTAGE },
    columnSpan: opts.columnSpan,
    margins: CELL_MARGINS,
    children: [labelParagraph(label), ...body],
  })
}

function valuePara(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: text || '—', size: BODY_SIZE })] })
}

function headerRow(cells: TableCell[]): TableRow {
  return new TableRow({ children: cells })
}

function phaseHeaderCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { fill: 'E6E6E6', type: ShadingType.CLEAR, color: 'auto' },
    margins: CELL_MARGINS,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: BODY_SIZE })] })],
  })
}

function phaseNameCell(label: string, sub: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    margins: CELL_MARGINS,
    children: [
      new Paragraph({ children: [new TextRun({ text: label, bold: true, size: BODY_SIZE })] }),
      new Paragraph({ children: [new TextRun({ text: sub, size: LABEL_SIZE, color: LABEL_COLOR })] }),
    ],
  })
}

function phaseBodyCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    margins: CELL_MARGINS,
    children: bodyParagraphs(text),
  })
}

export async function generateLessonWord(meta: LessonWordMeta, content: LessonNoteContent) {
  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      headerRow([fieldCell('Week Ending', [valuePara(content.week_ending)]), fieldCell('Day(s)', [valuePara(content.days)])]),
      headerRow([fieldCell('Subject', [valuePara(meta.subjectName)]), fieldCell('Class', [valuePara(meta.classLevel)])]),
      headerRow([fieldCell('Duration / Period', [valuePara(content.period)]), fieldCell('Class Size', [valuePara(content.class_size)])]),
      headerRow([fieldCell('Week', [valuePara(content.week_number)]), fieldCell('Lesson', [valuePara(content.lesson_number)])]),
      headerRow([fieldCell('Strand', [valuePara(meta.strand)]), fieldCell('Sub-Strand', [valuePara(meta.subStrand)])]),
      headerRow([fieldCell('Content Standard', [valuePara(meta.contentStandard ?? '—')], { widthPct: 100, columnSpan: 2 })]),
      headerRow([fieldCell(`Indicator (${meta.indicatorCode})`, [valuePara(meta.indicatorText)], { widthPct: 100, columnSpan: 2 })]),
      headerRow([fieldCell('Core Competencies', bulletParagraphs(content.core_competencies), { widthPct: 100, columnSpan: 2 })]),
      headerRow([fieldCell('Key Words', [valuePara(listOrDash(content.key_words))], { widthPct: 100, columnSpan: 2 })]),
      headerRow([fieldCell('References', [valuePara(content.references)], { widthPct: 100, columnSpan: 2 })]),
    ],
  })

  const phaseTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          phaseHeaderCell('Phase / Duration', 18),
          phaseHeaderCell("Learners' Activities", 62),
          phaseHeaderCell('Resources', 20),
        ],
      }),
      new TableRow({
        children: [
          phaseNameCell('PHASE 1', 'STARTER', 18),
          phaseBodyCell(content.phase1_starter, 62),
          phaseBodyCell('', 20),
        ],
      }),
      new TableRow({
        children: [
          phaseNameCell('PHASE 2', 'MAIN (New Learning)', 18),
          phaseBodyCell(content.phase2_main, 62),
          phaseBodyCell(listOrDash(content.tlrs), 20),
        ],
      }),
      new TableRow({
        children: [
          phaseNameCell('PHASE 3', 'PLENARY / REFLECTION', 18),
          phaseBodyCell(content.phase3_plenary, 62),
          phaseBodyCell('', 20),
        ],
      }),
    ],
  })

  const doc = new Document({
    // Sets the whole document's default font/size up front so nothing
    // falls back to Word's default Calibri theme (which is what made the
    // old export's fonts look inconsistent next to the tables).
    styles: {
      default: {
        document: { run: { font: 'Times New Roman', size: BODY_SIZE } },
      },
    },
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: `${meta.subjectName} · ${meta.classLevel} · Week ${content.week_number || '—'}`,
                size: LABEL_SIZE,
                color: LABEL_COLOR,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: 'WEEKLY LESSON NOTE', bold: true, size: 32 })],
          }),
          headerTable,
          new Paragraph({ text: '', spacing: { before: 200, after: 100 } }),
          phaseTable,
          new Paragraph({ text: '', spacing: { before: 300 } }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Vetted by: _____________________     ', size: BODY_SIZE }),
              new TextRun({ text: 'Signature: _____________     ', size: BODY_SIZE }),
              new TextRun({ text: 'Date: __________', size: BODY_SIZE }),
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
  const weekLabel = content.week_number ? `week-${content.week_number}` : 'lesson'
  link.download = `lesson-plan-${weekLabel}.docx`
  link.click()
  URL.revokeObjectURL(url)
}

// Testing steps:
// 1. As a Premium teacher, open a lesson, click "Download as Word."
// 2. Expected: a bordered table downloads, opens correctly in Microsoft
//    Word or Google Docs, and is fully editable — matching the PDF export
//    layout (label-on-top/value-below header cells, then a bordered
//    Phase / Learners' Activities / Resources grid), all in one
//    consistent Times New Roman font instead of Word's default theme.
// 3. Confirm all header fields, curriculum data, and the three phases
//    appear, matching what's on screen in the editor, and that long
//    Starter/Main/Plenary text keeps its line breaks.
