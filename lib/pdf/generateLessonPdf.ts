// Purpose: Builds a printable PDF of a lesson note, laid out as a real
// bordered Ghana Education Service-style lesson-note table (header
// logistics block + a Phase / Learners Activities / Resources grid) —
// matching the look of the paper lesson-note books teachers already use,
// instead of loose unbordered lines. Runs entirely in the browser via
// jsPDF + jspdf-autotable — no server call, no API key.
// Folder: lib/pdf/generateLessonPdf.ts
// Depends on: jspdf, jspdf-autotable
'use client'

import { jsPDF } from 'jspdf'
import autoTable, { type RowInput } from 'jspdf-autotable'
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

// Shared look-and-feel constants so the header table and the phase table
// always match each other, and so any future tweak (font, border weight)
// only needs to change in one place.
const FONT = 'times'
const INK: [number, number, number] = [20, 20, 20]
const LABEL_INK: [number, number, number] = [90, 90, 90]
const BORDER_COLOR: [number, number, number] = [0, 0, 0]
const BORDER_WIDTH = 0.6
const HEAD_FILL: [number, number, number] = [230, 230, 230]

// A "field" cell shows a small bold grey label on its own line, then the
// value underneath in normal black text — this is what makes each cell
// scannable instead of a wall of "Label: value" text mashed together.
// `span` optionally makes the cell stretch across both header columns,
// used for the longer curriculum fields (Content Standard, Indicator, etc).
function field(label: string, value: string, span?: 2) {
  return {
    content: `${label}\n${value || '—'}`,
    _label: label,
    _value: value || '—',
    ...(span ? { colSpan: span } : {}),
  }
}

function listOrDash(items: string[]): string {
  return items.filter(Boolean).length ? items.filter(Boolean).join('   •   ') : '—'
}

export function generateLessonPdf(meta: LessonPdfMeta, content: LessonNoteContent) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const usableWidth = pageWidth - margin * 2

  // ---- Letterhead --------------------------------------------------------
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...LABEL_INK)
  doc.text('TeacherAI Ghana — Weekly Lesson Note', margin, margin)
  doc.text(
    `${meta.subjectName}  ·  ${meta.classLevel}`,
    pageWidth - margin,
    margin,
    { align: 'right' }
  )

  doc.setFont(FONT, 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text('WEEKLY LESSON NOTE', pageWidth / 2, margin + 22, { align: 'center' })

  // Draws a "label on top, value below" cell exactly like the on-screen
  // preview and the Word export, so a printed copy and the editor always
  // agree on what each field looked like.
  function labelValueCell(data: any) {
    if (typeof data.cell.raw !== 'object' || !('_label' in data.cell.raw)) return
    const { _label, _value } = data.cell.raw as { _label: string; _value: string }
    const { x, y, width } = data.cell
    const padX = data.cell.padding('left')
    doc.setFont(FONT, 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...LABEL_INK)
    doc.text(_label.toUpperCase(), x + padX, y + 11)

    doc.setFont(FONT, 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    const valueLines = doc.splitTextToSize(_value, width - padX * 2)
    doc.text(valueLines, x + padX, y + 23)
    // Suppress autotable's own default text draw for this cell.
    data.cell.text = []
  }

  // ---- Header logistics + curriculum block -------------------------------
  const headerBody: RowInput[] = [
    [field('Week Ending', content.week_ending), field('Day(s)', content.days)],
    [field('Subject', meta.subjectName), field('Class', meta.classLevel)],
    [field('Duration / Period', content.period), field('Class Size', content.class_size)],
    [field('Week', content.week_number), field('Lesson', content.lesson_number)],
    [field('Strand', meta.strand), field('Sub-Strand', meta.subStrand)],
    [field('Content Standard', meta.contentStandard ?? '—', 2) as any],
    [field(`Indicator (${meta.indicatorCode})`, meta.indicatorText, 2) as any],
    [field('Core Competencies', listOrDash(content.core_competencies), 2) as any],
    [field('Key Words', listOrDash(content.key_words), 2) as any],
    [field('References', content.references, 2) as any],
  ]

  autoTable(doc, {
    startY: margin + 34,
    margin: { left: margin, right: margin },
    theme: 'grid',
    tableWidth: usableWidth,
    styles: {
      font: FONT,
      fontSize: 9.5,
      lineColor: BORDER_COLOR,
      lineWidth: BORDER_WIDTH,
      minCellHeight: 30,
      valign: 'top',
    },
    columnStyles: { 0: { cellWidth: usableWidth / 2 }, 1: { cellWidth: usableWidth / 2 } },
    body: headerBody,
    didParseCell: (data) => {
      // colSpan rows are stored as plain objects above; make sure the raw
      // cell keeps its _label/_value so didDrawCell can still find them.
      if (data.cell.raw && typeof data.cell.raw === 'object' && '_label' in (data.cell.raw as any)) {
        data.cell.text = ['']
      }
    },
    didDrawCell: labelValueCell,
  })

  // ---- Phase / Learners Activities / Resources table ---------------------
  const afterHeaderY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const resourcesText = listOrDash(content.tlrs)

  const phaseCol = usableWidth * 0.18
  const activitiesCol = usableWidth * 0.62
  const resourcesCol = usableWidth * 0.2

  autoTable(doc, {
    startY: afterHeaderY + 14,
    margin: { left: margin, right: margin },
    theme: 'grid',
    tableWidth: usableWidth,
    styles: {
      font: FONT,
      fontSize: 9.5,
      lineColor: BORDER_COLOR,
      lineWidth: BORDER_WIDTH,
      valign: 'top',
      cellPadding: 6,
      textColor: INK,
    },
    headStyles: {
      fillColor: HEAD_FILL,
      textColor: INK,
      fontStyle: 'bold',
      halign: 'left',
      lineColor: BORDER_COLOR,
      lineWidth: BORDER_WIDTH,
    },
    columnStyles: {
      0: { cellWidth: phaseCol, fontStyle: 'bold' },
      1: { cellWidth: activitiesCol },
      2: { cellWidth: resourcesCol },
    },
    head: [['Phase / Duration', "Learners' Activities", 'Resources']],
    body: [
      ['PHASE 1\nSTARTER', content.phase1_starter || '—', ''],
      ['PHASE 2\nMAIN (New Learning)', content.phase2_main || '—', resourcesText],
      ['PHASE 3\nPLENARY / REFLECTION', content.phase3_plenary || '—', ''],
    ],
  })

  // ---- Vetting footer ------------------------------------------------------
  const afterPhaseY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  let footerY = afterPhaseY + 30
  if (footerY > pageHeight - margin) {
    doc.addPage()
    footerY = margin + 20
  }
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text('Vetted by: _____________________', margin, footerY)
  doc.text('Signature: _____________', margin + 210, footerY)
  doc.text('Date: __________', margin + 350, footerY)

  const weekLabel = content.week_number ? `week-${content.week_number}` : 'lesson'
  doc.save(`lesson-plan-${weekLabel}.pdf`)
}

// Testing steps:
// 1. Fill in a few header fields (Week, Week Ending, Day) in the editor,
//    then click "Download as PDF."
// 2. Expected: a bordered table downloads with two clearly labelled
//    columns of header fields (Week Ending/Day, Subject/Class, etc.),
//    followed by a full-width Content Standard / Indicator / Core
//    Competencies / Key Words / References block, then a bordered
//    3-column "Phase / Duration | Learners' Activities | Resources"
//    table for Starter, Main, and Plenary, and a vetting line at the
//    bottom — all in a single serif font at consistent sizes.
// 3. Try a lesson with very long phase text — confirm the table grows
//    and moves to a new page cleanly (jspdf-autotable handles page
//    breaks and repeats column widths automatically).
