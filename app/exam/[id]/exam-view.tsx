// Purpose: Renders the exam paper in a clean, print-ready layout, with a
// Print button and a teacher-only answer key that's excluded from the
// printed page by default (a student shouldn't receive the answer key
// stapled to their exam).
// Folder: app/exam/[id]/exam-view.tsx
'use client'

import { useState } from 'react'
import type { ExamContent } from '@/lib/ai/examSchema'
import { Button } from '@/components/ui/button'

export function ExamView({
  subjectName,
  classLevel,
  content,
}: {
  subjectName: string
  classLevel: string
  content: ExamContent
}) {
  const [showAnswers, setShowAnswers] = useState(false)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Controls — excluded from the printed page via .print:hidden */}
      <div className="print:hidden mb-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => window.print()}>Print exam</Button>
        <Button variant="outline" onClick={() => setShowAnswers((s) => !s)}>
          {showAnswers ? 'Hide answer key' : 'Show answer key (for you only)'}
        </Button>
      </div>

      {/* The actual exam paper */}
      <div className="rounded-lg border bg-white p-8 print:border-none print:p-0">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold uppercase">{content.title}</h1>
          <p className="text-sm">{subjectName} — {classLevel}</p>
          <p className="text-sm">Time Allowed: {content.duration_minutes} minutes</p>
          <p className="text-sm">Total Marks: {content.total_marks}</p>
        </div>

        <p className="mb-6 text-sm italic">{content.instructions}</p>

        <h2 className="mb-3 font-bold">SECTION A — OBJECTIVE TEST</h2>
        <div className="mb-8 space-y-4">
          {content.objective_questions.map((q, i) => (
            <div key={i} className="text-sm">
              <p className="mb-1 font-medium">
                {i + 1}. {q.question_text} <span className="text-xs text-muted-foreground">({q.marks} mark{q.marks > 1 ? 's' : ''})</span>
              </p>
              <div className="ml-4 grid grid-cols-2 gap-x-4 gap-y-1">
                {q.options.map((opt, j) => (
                  <p key={j}>
                    {String.fromCharCode(65 + j)}. {opt}
                    {showAnswers && q.correct_answer === String.fromCharCode(65 + j) && (
                      <span className="ml-2 font-bold text-emerald-700 print:hidden">✓ correct</span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <h2 className="mb-3 font-bold">SECTION B — THEORY</h2>
        <p className="mb-4 text-xs italic">Answer all questions.</p>
        <div className="space-y-6">
          {content.theory_questions.map((q, i) => (
            <div key={i} className="text-sm">
              <p className="mb-1 font-medium">
                {i + 1}. {q.question_text} <span className="text-xs text-muted-foreground">({q.marks} marks)</span>
              </p>
              {showAnswers && (
                <p className="print:hidden ml-4 text-xs text-emerald-700">
                  Marking notes: {q.marking_notes}
                </p>
              )}
              {/* Blank answer space when actually printed for students */}
              <div className="mt-2 h-24 border-b border-dashed" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Testing steps:
// 1. Click "Show answer key" — correct answers get a green checkmark, and
//    marking notes appear under each theory question, both on-screen only.
// 2. Click "Print exam" — the browser's print preview should NOT show the
//    answer key or the two buttons, only the clean question paper.
// 3. Confirm objective questions show 4 options (A-D) and theory questions
//    have blank space beneath them for a printed copy.
