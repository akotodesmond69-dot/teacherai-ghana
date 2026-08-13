// Purpose: The interactive lesson-selection UI — pick a subject/class,
// then check off which of the teacher's own lessons to build the exam from.
// Folder: app/exam/picker.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateExamAction } from './actions'
import { getExamBand, EXAM_STRUCTURES } from '@/lib/ai/examSchema'
import { Button } from '@/components/ui/button'

interface LessonRow {
  id: string
  created_at: string
  curriculum_indicators: {
    indicator_text: string
    subject_id: string
    subjects: { name: string; class_level: string }
  }
}

export function ExamPicker({ lessons }: { lessons: LessonRow[] }) {
  const router = useRouter()

  // Group lessons by "subject + class" — an exam can only be built from
  // one such group at a time (enforced again, server-side, in actions.ts).
  const groups = useMemo(() => {
    const map = new Map<string, { subjectId: string; label: string; classLevel: string; lessons: LessonRow[] }>()
    for (const lesson of lessons) {
      const ind = lesson.curriculum_indicators
      const key = ind.subject_id
      if (!map.has(key)) {
        map.set(key, {
          subjectId: ind.subject_id,
          label: `${ind.subjects.name} · ${ind.subjects.class_level}`,
          classLevel: ind.subjects.class_level,
          lessons: [],
        })
      }
      map.get(key)!.lessons.push(lesson)
    }
    return Array.from(map.values())
  }, [lessons])

  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.subjectId ?? '')
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeGroup = groups.find((g) => g.subjectId === selectedGroupId)
  const structure = activeGroup ? EXAM_STRUCTURES[getExamBand(activeGroup.classLevel)] : null

  function toggleLesson(id: string) {
    setSelectedLessonIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    const result = await generateExamAction(selectedLessonIds)

    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.push(`/exam/${result.examId}`)
  }

  if (lessons.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        You haven't generated any lessons yet. Go to{' '}
        <a href="/generate" className="underline">Generate a lesson</a> first —
        exams are built from your own lessons.
      </p>
    )
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Subject &amp; Class</label>
      <select
        className="mb-2 w-full rounded-md border p-2 text-sm"
        value={selectedGroupId}
        onChange={(e) => {
          setSelectedGroupId(e.target.value)
          setSelectedLessonIds([])
        }}
      >
        {groups.map((g) => (
          <option key={g.subjectId} value={g.subjectId}>{g.label}</option>
        ))}
      </select>

      {structure && (
        <p className="mb-4 text-xs text-muted-foreground">
          Exam structure for {structure.label}: {structure.objectiveCount} objective questions
          ({structure.marksPerObjective} mark{structure.marksPerObjective > 1 ? 's' : ''} each) +{' '}
          {structure.theoryCount} theory questions ({structure.marksPerTheory} marks each) ={' '}
          {structure.totalMarks} marks total.
        </p>
      )}

      <label className="mb-1 block text-sm font-medium">
        Lessons to include ({selectedLessonIds.length} selected)
      </label>
      <div className="mb-6 space-y-2">
        {activeGroup?.lessons.map((lesson) => (
          <label key={lesson.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={selectedLessonIds.includes(lesson.id)}
              onChange={() => toggleLesson(lesson.id)}
              className="mt-1"
            />
            {lesson.curriculum_indicators.indicator_text}
          </label>
        ))}
      </div>

      <Button onClick={handleGenerate} disabled={loading || selectedLessonIds.length === 0} className="w-full">
        {loading ? 'Generating exam…' : 'Generate exam'}
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  )
}
