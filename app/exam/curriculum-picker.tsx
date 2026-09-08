// Purpose: Lets a Premium teacher build a STANDARD exam straight from the
// official curriculum — pick a class band, subject, then check off one or
// more indicators — without needing to have generated any lessons first.
// Mirrors the Lesson Generator's own band/subject/indicator picker
// (app/generate/page.tsx) so the interaction feels familiar, but allows
// multi-select since an exam is built from several indicators at once.
// Folder: app/exam/curriculum-picker.tsx
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateExamFromCurriculumAction } from './actions'
import { getExamBand, EXAM_STRUCTURES } from '@/lib/ai/examSchema'
import { getClassBand, BAND_LABELS, BAND_ORDER, type ClassBand } from '@/lib/curriculum/bands'
import { Button } from '@/components/ui/button'

export interface IndicatorOption {
  id: string
  indicator_text: string
  indicator_code: string
  strand: string
  sub_strand: string
  is_verified: boolean
  subject_id: string
  subjects: { name: string; class_level: string }
}

export function CurriculumExamPicker({ indicators }: { indicators: IndicatorOption[] }) {
  const router = useRouter()

  const bandsWithSubjects = useMemo(() => {
    const map = new Map<ClassBand, Map<string, { label: string; classLevel: string; items: IndicatorOption[] }>>()
    for (const ind of indicators) {
      const b = getClassBand(ind.subjects.class_level)
      const key = ind.subject_id
      if (!map.has(b)) map.set(b, new Map())
      const subjMap = map.get(b)!
      if (!subjMap.has(key)) {
        subjMap.set(key, {
          label: `${ind.subjects.name} · ${ind.subjects.class_level}`,
          classLevel: ind.subjects.class_level,
          items: [],
        })
      }
      subjMap.get(key)!.items.push(ind)
    }
    return map
  }, [indicators])

  const availableBands = BAND_ORDER.filter((b) => bandsWithSubjects.has(b))
  const [band, setBand] = useState<ClassBand>(availableBands[0] ?? 'upper_primary')
  const subjectsInBand = bandsWithSubjects.get(band)
  const [subjectKey, setSubjectKey] = useState('')
  const activeSubjectKey = subjectKey || Array.from(subjectsInBand?.keys() ?? [])[0] || ''
  const activeGroup = subjectsInBand?.get(activeSubjectKey)

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const structure = activeGroup ? EXAM_STRUCTURES[getExamBand(activeGroup.classLevel)] : null

  function toggleIndicator(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function selectAllInGroup() {
    if (!activeGroup) return
    setSelectedIds(activeGroup.items.map((i) => i.id))
  }

  async function handleGenerate() {
    setLoading(true)
    setError(null)

    const result = await generateExamFromCurriculumAction(selectedIds)

    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.push(`/exam/${result.examId}`)
  }

  if (indicators.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No curriculum indicators are available yet.
      </p>
    )
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Class group</label>
      <div className="mb-4 flex flex-wrap gap-2">
        {availableBands.map((b) => (
          <button
            key={b}
            onClick={() => { setBand(b); setSubjectKey(''); setSelectedIds([]) }}
            className={`rounded-full px-3 py-1 text-xs ${
              band === b ? 'bg-chalkboard text-white' : 'border border-neutral-300'
            }`}
          >
            {BAND_LABELS[b]}
          </button>
        ))}
      </div>

      <label className="mb-1 block text-sm font-medium">Subject &amp; Class</label>
      <select
        className="mb-2 w-full rounded-md border p-2 text-sm"
        value={activeSubjectKey}
        onChange={(e) => { setSubjectKey(e.target.value); setSelectedIds([]) }}
      >
        {Array.from(subjectsInBand?.entries() ?? []).map(([key, group]) => (
          <option key={key} value={key}>{group.label}</option>
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

      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium">
          Curriculum indicators to cover ({selectedIds.length} selected)
        </label>
        {activeGroup && activeGroup.items.length > 1 && (
          <button onClick={selectAllInGroup} className="text-xs text-info-blue underline">
            Select all in this subject
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Pick every topic this exam should cover — the AI writes a standard
        paper testing all of them, whether or not you've generated a lesson
        for that topic yet.
      </p>
      <div className="mb-6 space-y-2">
        {activeGroup?.items.map((ind) => (
          <label key={ind.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(ind.id)}
              onChange={() => toggleIndicator(ind.id)}
              className="mt-1"
            />
            <span>
              {!ind.is_verified && (
                <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  Community
                </span>
              )}
              <span className="text-muted-foreground">
                {ind.strand} → {ind.sub_strand} — {ind.indicator_text}
              </span>
            </span>
          </label>
        ))}
        {(!activeGroup || activeGroup.items.length === 0) && (
          <p className="text-sm text-muted-foreground">No indicators in this group yet.</p>
        )}
      </div>

      <Button onClick={handleGenerate} disabled={loading || selectedIds.length === 0} className="w-full">
        {loading ? 'Generating standard exam…' : 'Generate standard exam'}
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  )
}
