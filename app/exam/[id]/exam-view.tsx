// Purpose: The exam editor + print/export view. A teacher can now edit
// every question's text, options, correct answer, and marks (plus the
// exam-level title/instructions/duration) before exporting — matching the
// same "generate, then refine" pattern already used by the Lesson Editor.
// Export targets: browser Print (unchanged), and the new Download as
// PDF / Download as Word, both with an answer-key-included toggle since a
// teacher may want a clean student copy and a marked copy from the same
// exam. All editing and export is Premium-only — the page-level gate in
// app/exam/page.tsx keeps non-Premium teachers from generating an exam at
// all, but this component re-checks via the `isPremium` prop before
// showing edit/export controls, since a teacher's subscription can lapse
// after an exam was generated.
// Folder: app/exam/[id]/exam-view.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { saveExamAction } from '../actions'
import { generateExamPdf } from '@/lib/pdf/generateExamPdf'
import { generateExamWord } from '@/lib/word/generateExamWord'
import type { ExamContent, ObjectiveQuestion, TheoryQuestion } from '@/lib/ai/examSchema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function ExamView({
  examId,
  subjectName,
  classLevel,
  content: initialContent,
  isPremium,
}: {
  examId: string
  subjectName: string
  classLevel: string
  content: ExamContent
  isPremium: boolean
}) {
  const [content, setContent] = useState<ExamContent>(initialContent)
  const [editing, setEditing] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)
  const [includeAnswerKeyInExport, setIncludeAnswerKeyInExport] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function updateMeta(field: 'title' | 'instructions', value: string) {
    setContent((prev) => ({ ...prev, [field]: value }))
    setSavedMessage(null)
  }

  function updateDuration(value: string) {
    const num = parseInt(value, 10)
    setContent((prev) => ({ ...prev, duration_minutes: isNaN(num) ? 0 : num }))
    setSavedMessage(null)
  }

  function updateObjective(index: number, field: keyof ObjectiveQuestion, value: string) {
    setContent((prev) => {
      const questions = [...prev.objective_questions]
      const q = { ...questions[index] }
      if (field === 'marks') {
        q.marks = parseInt(value, 10) || 0
      } else if (field === 'question_text' || field === 'correct_answer') {
        ;(q as any)[field] = value
      }
      questions[index] = q
      return { ...prev, objective_questions: questions }
    })
    setSavedMessage(null)
  }

  function updateObjectiveOption(qIndex: number, optIndex: number, value: string) {
    setContent((prev) => {
      const questions = [...prev.objective_questions]
      const q = { ...questions[qIndex] }
      const options = [...q.options]
      options[optIndex] = value
      q.options = options
      questions[qIndex] = q
      return { ...prev, objective_questions: questions }
    })
    setSavedMessage(null)
  }

  function updateTheory(index: number, field: keyof TheoryQuestion, value: string) {
    setContent((prev) => {
      const questions = [...prev.theory_questions]
      const q = { ...questions[index] }
      if (field === 'marks') {
        q.marks = parseInt(value, 10) || 0
      } else if (field === 'question_text' || field === 'marking_notes') {
        ;(q as any)[field] = value
      }
      questions[index] = q
      return { ...prev, theory_questions: questions }
    })
    setSavedMessage(null)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await saveExamAction(examId, content)
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSavedMessage('Saved ✓')
  }

  function handleDownloadPdf() {
    generateExamPdf({ subjectName, classLevel }, content, includeAnswerKeyInExport)
  }

  function handleDownloadWord() {
    generateExamWord({ subjectName, classLevel }, content, includeAnswerKeyInExport)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Controls — excluded from the printed page via .print:hidden */}
      <div className="print:hidden mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={() => window.print()}>Print exam</Button>
        <Button variant="outline" onClick={() => setShowAnswers((s) => !s)}>
          {showAnswers ? 'Hide answer key' : 'Show answer key (for you only)'}
        </Button>
        {isPremium && (
          <Button variant="outline" onClick={() => setEditing((e) => !e)}>
            {editing ? 'Done editing' : 'Edit questions'}
          </Button>
        )}
        {isPremium && (
          <Link
            href={`/exam/${examId}/document`}
            className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            Open Word Processor →
          </Link>
        )}
      </div>

      {!isPremium && (
        <p className="print:hidden mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Editing and exporting to PDF/Word are Premium features.{' '}
          <Link href="/billing" className="underline">Upgrade to unlock them</Link> for this exam.
        </p>
      )}

      {isPremium && (
        <div className="print:hidden mb-6 rounded-lg border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeAnswerKeyInExport}
                onChange={(e) => setIncludeAnswerKeyInExport(e.target.checked)}
              />
              Include answer key in exported file
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownloadPdf}>Download as PDF</Button>
              <Button variant="outline" onClick={handleDownloadWord}>Download as Word</Button>
            </div>
          </div>
          {editing && (
            <div className="flex items-center gap-3 border-t pt-3">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
              {savedMessage && <span className="text-sm text-emerald-700">{savedMessage}</span>}
              {error && <span className="text-sm text-red-600">{error}</span>}
            </div>
          )}
        </div>
      )}

      {/* The actual exam paper */}
      <div className="rounded-lg border bg-white p-8 print:border-none print:p-0">
        <div className="mb-6 text-center">
          {editing ? (
            <Input
              value={content.title}
              onChange={(e) => updateMeta('title', e.target.value)}
              className="mb-2 text-center text-lg font-bold uppercase"
            />
          ) : (
            <h1 className="text-lg font-bold uppercase">{content.title}</h1>
          )}
          <p className="text-sm">{subjectName} — {classLevel}</p>
          {editing ? (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm">
              <span>Time Allowed:</span>
              <Input
                type="number"
                value={content.duration_minutes}
                onChange={(e) => updateDuration(e.target.value)}
                className="w-24 text-center"
              />
              <span>minutes</span>
            </div>
          ) : (
            <p className="text-sm">Time Allowed: {content.duration_minutes} minutes</p>
          )}
          <p className="text-sm">Total Marks: {content.total_marks}</p>
        </div>

        {editing ? (
          <Textarea
            value={content.instructions}
            onChange={(e) => updateMeta('instructions', e.target.value)}
            rows={2}
            className="mb-6 text-sm italic"
          />
        ) : (
          <p className="mb-6 text-sm italic">{content.instructions}</p>
        )}

        <h2 className="mb-3 font-bold">SECTION A — OBJECTIVE TEST</h2>
        <div className="mb-8 space-y-4">
          {content.objective_questions.map((q, i) =>
            editing ? (
              <div key={i} className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex items-start gap-2">
                  <span className="mt-2 font-medium">{i + 1}.</span>
                  <Textarea
                    value={q.question_text}
                    onChange={(e) => updateObjective(i, 'question_text', e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={q.marks}
                      onChange={(e) => updateObjective(i, 'marks', e.target.value)}
                      className="w-16"
                    />
                    <span className="text-xs text-muted-foreground">marks</span>
                  </div>
                </div>
                <div className="ml-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <span className="w-5 shrink-0 font-medium">{String.fromCharCode(65 + j)}.</span>
                      <Input value={opt} onChange={(e) => updateObjectiveOption(i, j, e.target.value)} />
                    </div>
                  ))}
                </div>
                <div className="ml-6 mt-2 flex items-center gap-2 text-xs">
                  <span className="font-medium">Correct answer:</span>
                  <select
                    className="rounded-md border p-1"
                    value={q.correct_answer}
                    onChange={(e) => updateObjective(i, 'correct_answer', e.target.value)}
                  >
                    {q.options.map((_, j) => {
                      const letter = String.fromCharCode(65 + j)
                      return <option key={letter} value={letter}>{letter}</option>
                    })}
                  </select>
                </div>
              </div>
            ) : (
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
            )
          )}
        </div>

        <h2 className="mb-3 font-bold">SECTION B — THEORY</h2>
        <p className="mb-4 text-xs italic">Answer all questions.</p>
        <div className="space-y-6">
          {content.theory_questions.map((q, i) =>
            editing ? (
              <div key={i} className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex items-start gap-2">
                  <span className="mt-2 font-medium">{i + 1}.</span>
                  <Textarea
                    value={q.question_text}
                    onChange={(e) => updateTheory(i, 'question_text', e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={q.marks}
                      onChange={(e) => updateTheory(i, 'marks', e.target.value)}
                      className="w-16"
                    />
                    <span className="text-xs text-muted-foreground">marks</span>
                  </div>
                </div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Marking notes (for you only, never printed for students)
                </label>
                <Textarea
                  value={q.marking_notes}
                  onChange={(e) => updateTheory(i, 'marking_notes', e.target.value)}
                  rows={2}
                  className="ml-6 w-[calc(100%-1.5rem)]"
                />
              </div>
            ) : (
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
            )
          )}
        </div>
      </div>
    </div>
  )
}

// Testing steps:
// 1. As a Premium teacher, click "Edit questions." Expected: every field
//    (title, duration, instructions, each question's text/options/marks/
//    correct answer, each theory question's marking notes) becomes
//    editable in place.
// 2. Change an option's wording and its correct-answer letter, click "Save
//    changes." Expected: "Saved ✓", and reloading the page shows the edit
//    persisted.
// 3. Try saving after deleting a question's text entirely — should still
//    save (empty text is allowed), but removing a whole question from the
//    array isn't exposed in this UI, so the required count for the grade
//    can't be broken from here.
// 4. With the answer-key checkbox OFF, click "Download as PDF" — the file
//    should contain no correct answers or marking notes. Toggle it ON and
//    download again — expect an extra answer-key page/section.
// 5. As a non-Premium teacher viewing an older exam, expected: no "Edit
//    questions" button, no export buttons, just an upgrade notice, Print
//    and the on-screen answer-key toggle still work as before.
