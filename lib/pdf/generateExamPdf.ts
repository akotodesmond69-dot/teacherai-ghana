// Purpose: Builds a printable PDF of a generated exam — question paper
// laid out for students (Section A objective, Section B theory, blank
// answer space), with an optional answer key appended on its own page for
// the teacher only. Runs entirely in the browser via jsPDF — no server
// call, no API key. Premium-only; gating happens in the caller
// (app/exam/[id]/exam-view.tsx), not here.
// Folder: lib/pdf/generateExamPdf.ts
// Depends on: jspdf
'use client'

import { jsPDF } from 'jspdf'
import type { ExamContent } from '@/lib/ai/examSchema'

export interface ExamPdfMeta {
  subjectName: string
  classLevel: string
}

export function generateExamPdf(meta: ExamPdfMeta, content: ExamContent, includeAnswerKey: boolean) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const maxWidth = pageWidth - margin * 2
  let y = margin

  function addLine(text: string, size: number, isBold = false, spacingAfter = 8) {
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

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Header — matches the standard Ghanaian exam-paper cover block.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(content.title.toUpperCase(), pageWidth / 2, y, { align: 'center' })
  y += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text(`${meta.subjectName} — ${meta.classLevel}`, pageWidth / 2, y, { align: 'center' })
  y += 16
  doc.text(`Time Allowed: ${content.duration_minutes} minutes`, pageWidth / 2, y, { align: 'center' })
  y += 16
  doc.text(`Total Marks: ${content.total_marks}`, pageWidth / 2, y, { align: 'center' })
  y += 22

  addLine(content.instructions, 10, false, 16)

  addLine('SECTION A — OBJECTIVE TEST', 12, true, 8)
  content.objective_questions.forEach((q, i) => {
    ensureSpace(60)
    addLine(`${i + 1}. ${q.question_text}  (${q.marks} mark${q.marks > 1 ? 's' : ''})`, 10, false, 2)
    const optionsLine = q.options
      .map((opt, j) => `${String.fromCharCode(65 + j)}. ${opt}`)
      .join('     ')
    addLine(optionsLine, 10, false, 8)
  })

  y += 6
  addLine('SECTION B — THEORY', 12, true, 4)
  addLine('Answer all questions.', 9, false, 10)
  content.theory_questions.forEach((q, i) => {
    ensureSpace(90)
    addLine(`${i + 1}. ${q.question_text}  (${q.marks} marks)`, 10, false, 4)
    // Blank ruled answer space for the printed student copy.
    const lineY = y
    doc.setDrawColor(180)
    doc.line(margin, lineY + 60, pageWidth - margin, lineY + 60)
    y += 68
  })

  if (includeAnswerKey) {
    doc.addPage()
    y = margin
    addLine('ANSWER KEY — FOR TEACHER USE ONLY', 13, true, 12)

    addLine('Section A — Objective', 11, true, 4)
    const answerLines = content.objective_questions
      .map((q, i) => `${i + 1}. ${q.correct_answer}`)
      .join('    ')
    addLine(answerLines, 10, false, 12)

    addLine('Section B — Theory (marking notes)', 11, true, 6)
    content.theory_questions.forEach((q, i) => {
      ensureSpace(40)
      addLine(`${i + 1}. ${q.marking_notes}`, 10, false, 8)
    })
  }

  doc.save(`${slugify(content.title)}.pdf`)
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'exam'
}

// Testing steps:
// 1. On a generated/edited exam, click "Download as PDF" with the answer
//    key toggle OFF. Expected: a clean question paper only — Section A
//    with 4 lettered options per question and Section B with ruled answer
//    space, no correct-answer markers or marking notes anywhere.
// 2. Toggle the answer key ON and download again. Expected: an extra final
//    page listing every objective answer letter and every theory
//    question's marking notes.
// 3. Confirm total_marks and duration_minutes shown match what's on screen.
