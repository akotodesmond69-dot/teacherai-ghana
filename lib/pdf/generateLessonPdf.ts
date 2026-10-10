// Purpose: Builds a printable PDF of a lesson note, laid out as a bordered
// table like the real Ghana Education Service lesson plan book — header
// grid, curriculum data, and the three teaching phases. Runs entirely in
// the browser via jsPDF — no server call, no API key, no external service.
// Folder: lib/pdf/generateLessonPdf.ts
// Depends on: jspdf
'use client'

import { jsPDF } from 'jspdf'
import type { LessonNoteContent } from '@/lib/ai/lessonSchema'

export interface LessonPdfMeta {
  subjectName: string
  classLevel: string
  strand: string
  subStrand: string
  contentStandard: string | null
  indicatorText: string
  indicatorCode: string
}

// Every piece of text inside the tables is this size (the default the
// teacher asked for). Titles outside the tables are separate.
const TABLE_FONT_SIZE = 12
const LINE_HEIGHT = TABLE_FONT_SIZE * 1.3
const CELL_PAD = 6

interface Cell {
  text: string | string[] // string[] = bullet list
  width: number
  bold?: boolean
  shaded?: boolean
}

export function generateLessonPdf(meta: LessonPdfMeta, content: LessonNoteContent) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const tableWidth = pageWidth - margin * 2 // 515pt
  const bottomLimit = pageHeight - margin
  let y = margin

  // Column layouts. Header grid: label | value | label | value.
  const hLabel = 80
  const hValue = (tableWidth - hLabel * 2) / 2
  // Main table: label | value.
  const labelCol = 130
  const valueCol = tableWidth - labelCol

  function newPage() {
    doc.addPage()
    y = margin
  }

  // Wraps text to a cell's inner width. jsPDF's splitTextToSize honours
  // "\n", so the AI's own line breaks (numbered steps etc.) are kept.
  function wrap(text: string | string[], width: number, bold: boolean): string[] {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(TABLE_FONT_SIZE)
    const inner = width - CELL_PAD * 2
    if (Array.isArray(text)) {
      const items = text.map((t) => t.trim()).filter(Boolean)
      if (items.length === 0) return ['—']
      return items.flatMap((item) => doc.splitTextToSize(`•  ${item}`, inner) as string[])
    }
    const value = text && text.trim() ? text : ''
    return value ? (doc.splitTextToSize(value, inner) as string[]) : ['']
  }

  // Draws one table row. If the row is taller than the space left on the
  // page, it is split line-by-line across pages (borders redrawn on each
  // page) — so a long Phase 2 is never cut off or pushed off the page.
  function drawRow(cells: Cell[]) {
    const wrapped = cells.map((c) => wrap(c.text, c.width, !!c.bold))
    const totalLines = Math.max(1, ...wrapped.map((l) => l.length))
    let i = 0

    // Don't start a long row with just a line or two at the bottom of a
    // page (it leaves the label cut off, e.g. "Phase 2: Main (new").
    // Short rows still need to fit whole; long rows need at least 4 lines.
    const minLinesToStart = Math.min(totalLines, 4)
    if (Math.floor((bottomLimit - y - CELL_PAD * 2) / LINE_HEIGHT) < minLinesToStart) newPage()

    while (i < totalLines) {
      let linesFit = Math.floor((bottomLimit - y - CELL_PAD * 2) / LINE_HEIGHT)
      if (linesFit < 1) {
        newPage()
        linesFit = Math.floor((bottomLimit - y - CELL_PAD * 2) / LINE_HEIGHT)
      }
      const take = Math.min(linesFit, totalLines - i)
      const segHeight = take * LINE_HEIGHT + CELL_PAD * 2

      let x = margin
      cells.forEach((c, ci) => {
        // Background + border first, then text on top.
        if (c.shaded) {
          doc.setFillColor(237, 237, 237)
          doc.rect(x, y, c.width, segHeight, 'F')
        }
        doc.setDrawColor(60)
        doc.setLineWidth(0.6)
        doc.rect(x, y, c.width, segHeight, 'S')

        doc.setFont('helvetica', c.bold ? 'bold' : 'normal')
        doc.setFontSize(TABLE_FONT_SIZE)
        doc.setTextColor(0)
        wrapped[ci].slice(i, i + take).forEach((line, li) => {
          doc.text(line, x + CELL_PAD, y + CELL_PAD + li * LINE_HEIGHT, { baseline: 'top' })
        })
        x += c.width
      })

      y += segHeight
      i += take
    }
  }

  const detail = (label: string, value: string | string[]) =>
    drawRow([
      { text: label, width: labelCol, bold: true, shaded: true },
      { text: value, width: valueCol },
    ])

  const headerPair = (l1: string, v1: string, l2: string, v2: string) =>
    drawRow([
      { text: l1, width: hLabel, bold: true, shaded: true },
      { text: v1, width: hValue },
      { text: l2, width: hLabel, bold: true, shaded: true },
      { text: v2, width: hValue },
    ])

  // ---- Title ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('LESSON PLAN', pageWidth / 2, y, { align: 'center', baseline: 'top' })
  y += 30

  // ---- Header grid (blank values are left empty to hand-write) ----
  headerPair('Week', content.week_number, 'Subject', meta.subjectName)
  headerPair('Class', meta.classLevel, 'Class Size', content.class_size)
  headerPair('Week Ending', content.week_ending, 'Day(s)', content.days)
  headerPair('Date', content.date, 'Period', content.period)
  drawRow([
    { text: 'Lesson', width: hLabel, bold: true, shaded: true },
    { text: content.lesson_number, width: tableWidth - hLabel },
  ])
  y += 12

  // ---- Main table ----
  detail('Strand', meta.strand)
  detail('Sub-strand', meta.subStrand)
  detail('Indicator (code)', meta.indicatorCode)
  detail('Content standard', meta.contentStandard ?? '—')
  detail('Performance indicator', meta.indicatorText)
  detail('Core Competencies', content.core_competencies)
  detail('Key Words', content.key_words.join(', ') || '—')
  detail('T.L.R(s)', content.tlrs)
  detail('Ref', content.references || '—')
  detail('Phase 1: Starter (preparing the brain for learning)', content.phase1_starter || '—')
  detail('Phase 2: Main (new learning, including assessment)', content.phase2_main || '—')
  detail('Phase 3: Plenary / Reflections', content.phase3_plenary || '—')

  // ---- Vetting line: placed right after the table (not pinned to the page
  // bottom, where it used to overprint the last lines of text). ----
  y += 24
  if (y > bottomLimit - 20) newPage()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(TABLE_FONT_SIZE)
  doc.text('Vetted by: ____________________', margin, y, { baseline: 'top' })
  doc.text('Signature: ____________', margin + 220, y, { baseline: 'top' })
  doc.text('Date: __________', margin + 400, y, { baseline: 'top' })

  doc.save('lesson-plan.pdf')
}

// Testing steps:
// 1. Fill in a few header fields, then click "Download as PDF."
// 2. Expected: lesson-plan.pdf with a bordered header grid and a bordered
//    two-column table, all 12 pt; long cells wrap inside their column; a
//    long Phase 2 continues onto the next page with borders intact; the
//    "Vetted by" line sits below the table without touching it.
