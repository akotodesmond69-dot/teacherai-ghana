// Purpose: Print-ready display of a generated exercise, with a
// teacher-only answer key toggle — same pattern as the Exam Generator's view.
// Folder: app/exercises/[id]/exercise-view.tsx
'use client'

import { useState } from 'react'
import type { ExerciseContent } from '@/lib/ai/exerciseSchema'
import { Button } from '@/components/ui/button'

export function ExerciseView({ sourceSummary, content }: { sourceSummary: string; content: ExerciseContent }) {
  const [showAnswers, setShowAnswers] = useState(false)

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="print:hidden mb-6 flex flex-wrap items-center gap-3">
        <Button onClick={() => window.print()}>Print</Button>
        <Button variant="outline" onClick={() => setShowAnswers((s) => !s)}>
          {showAnswers ? 'Hide answer key' : 'Show answer key (for you only)'}
        </Button>
      </div>

      <div className="rounded-lg border bg-white p-8 print:border-none print:p-0">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-bold">{content.title}</h1>
          <p className="text-xs text-muted-foreground">Source: {sourceSummary}</p>
          <p className="text-sm">Total Marks: {content.total_marks}</p>
        </div>

        <p className="mb-6 text-sm italic">{content.instructions}</p>

        <div className="space-y-6">
          {content.questions.map((q, i) => (
            <div key={i} className="text-sm">
              <p className="mb-1 font-medium">
                {i + 1}. {q.question_text} <span className="text-xs text-muted-foreground">({q.marks} mark{q.marks > 1 ? 's' : ''})</span>
              </p>
              {q.question_type === 'objective' && q.options && (
                <div className="ml-4 grid grid-cols-2 gap-x-4 gap-y-1">
                  {q.options.map((opt, j) => (
                    <p key={j}>
                      {String.fromCharCode(65 + j)}. {opt}
                      {showAnswers && q.correct_answer === String.fromCharCode(65 + j) && (
                        <span className="print:hidden ml-2 font-bold text-emerald-700">✓</span>
                      )}
                    </p>
                  ))}
                </div>
              )}
              {q.question_type !== 'objective' && (
                <>
                  <div className="mt-2 h-16 border-b border-dashed" />
                  {showAnswers && (
                    <p className="print:hidden mt-1 text-xs text-emerald-700">Model answer: {q.correct_answer}</p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {showAnswers && (
          <div className="print:hidden mt-6 rounded-lg bg-neutral-50 p-4 text-sm">
            <p className="mb-1 font-medium">Marking scheme</p>
            <p className="text-muted-foreground">{content.marking_scheme}</p>
          </div>
        )}
      </div>
    </div>
  )
}
