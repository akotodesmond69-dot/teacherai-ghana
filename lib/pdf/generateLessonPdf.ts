// Purpose: Builds a printable PDF of a lesson note, laid out to match the
// real Ghana Education Service lesson plan book format — header logistics,
// curriculum data, and the three teaching phases. Runs entirely in the
// browser via jsPDF — no server call, no API key, no external service.
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

export function generateLessonPdf(meta: LessonPdfMeta, content: LessonNoteContent) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const maxWidth = pageWidth - margin * 2
  let y = margin

  // Same page-break helper as before — jsPDF doesn't wrap text or add
  // pages automatically, so we track the vertical position ourselves.
  function addLine(text: string, size: number, isBold = false, spacingAfter = 10) {
    doc.setFont('helvetica', isBold ? 'bold' : 'normal')
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, maxWidth)
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += size * 1.3
    }
    y += spacingAfter
  }

  // Two label/value pairs on one line — used for the compact header
  // fields (Week / Subject, Class Size / Day, etc.), matching how the
  // paper version packs several short fields into one row.
  function addLabelRow(pairs: [string, string][]) {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    const colWidth = maxWidth / pairs.length
    doc.setFontSize(10)
    pairs.forEach(([label, value], i) => {
      const x = margin + i * colWidth
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}: `, x, y)
      const labelWidth = doc.getTextWidth(`${label}: `)
      doc.setFont('helvetica', 'normal')
      doc.text(value || '________', x + labelWidth, y)
    })
    y += 20
  }

  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('LESSON PLAN', pageWidth / 2, y, { align: 'center' })
  y += 28

  // Header logistics — matches the top section of the paper lesson plan book
  addLabelRow([
    ['Week', content.week_number],
    ['Subject', meta.subjectName],
    ['Class', meta.classLevel],
  ])
  addLabelRow([
    ['Week Ending', content.week_ending],
    ['Class Size', content.class_size],
  ])
  addLabelRow([
    ['Day(s)', content.days],
    ['Date', content.date],
    ['Period', content.period],
    ['Lesson', content.lesson_number],
  ])
  y += 8

  // Curriculum data — real, verified NaCCA data (Phase 3/5), not editable
  // by the teacher, so it's presented plainly rather than as form fields.
  addLine('Strand', 11, true, 2)
  addLine(meta.strand, 11, false, 8)
  addLine('Sub-strand', 11, true, 2)
  addLine(meta.subStrand, 11, false, 8)
  addLabelRow([
    ['Indicator (code)', meta.indicatorCode],
    ['Content standard', meta.contentStandard ?? '—'],
  ])
  addLine('Performance indicator', 11, true, 2)
  addLine(meta.indicatorText, 11, false, 14)

  // Core competencies / Key words / T.L.R(s) / Ref
  addLine('Core Competencies', 11, true, 2)
  addLine(content.core_competencies.map((v) => `•  ${v}`).join('\n') || '—', 10, false, 8)

  addLine('Key Words', 11, true, 2)
  addLine(content.key_words.join(', ') || '—', 10, false, 8)

  addLine('T.L.R(s)', 11, true, 2)
  addLine(content.tlrs.map((v) => `•  ${v}`).join('\n') || '—', 10, false, 8)

  addLine('Ref', 11, true, 2)
  addLine(content.references || '—', 10, false, 16)

  // The three teaching phases — the real Ghana lesson structure
  addLine('Phase 1: Starter (preparing the brain for learning)', 12, true, 4)
  addLine(content.phase1_starter || '—', 11, false, 16)

  addLine('Phase 2: Main (new learning, including assessment)', 12, true, 4)
  addLine(content.phase2_main || '—', 11, false, 16)

  addLine('Phase 3: Plenary / Reflections', 12, true, 4)
  addLine(content.phase3_plenary || '—', 11, false, 16)

  // Vetting line — matches the "Vetted by / Signature / Date" footer on
  // the paper version's second page.
  if (y > pageHeight - margin - 30) {
    doc.addPage()
    y = margin
  }
  y = pageHeight - margin
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Vetted by: _____________________', margin, y)
  doc.text('Signature: _____________', margin + 220, y)
  doc.text('Date: __________', margin + 380, y)

  doc.save('lesson-plan.pdf')
}

// Testing steps:
// 1. Fill in a few header fields (Week, Week Ending, Day) in the editor,
//    then click "Download as PDF."
// 2. Expected: a file named lesson-plan.pdf downloads immediately with
//    "LESSON PLAN" centered at the top, the header fields you just typed,
//    the real curriculum data, core competencies/key words/T.L.R(s)/ref,
//    the three phases, and a vetting line at the bottom of the last page.
