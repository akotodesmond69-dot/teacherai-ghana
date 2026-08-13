// Purpose: Lets a teacher pick a curriculum indicator, question types, and
// question count, then generate an assessment.
// Folder: app/assessment/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateAssessmentAction } from './actions'
import type { QuestionType } from '@/lib/ai/assessmentSchema'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/app-nav'

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'short_answer', label: 'Short answer' },
  { value: 'essay', label: 'Essay' },
  { value: 'fill_in_blank', label: 'Fill in the blank' },
  { value: 'matching', label: 'Matching' },
]

export default function AssessmentGeneratorPage() {
  const supabase = createClient()
  const router = useRouter()

  const [indicators, setIndicators] = useState<any[]>([])
  const [selectedIndicator, setSelectedIndicator] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['multiple_choice'])
  const [numQuestions, setNumQuestions] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('curriculum_indicators')
      .select('id, indicator_text, subjects(name, class_level)')
      .then(({ data }) => data && setIndicators(data))
  }, [])

  function toggleType(type: QuestionType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  async function handleGenerate() {
    if (!selectedIndicator || selectedTypes.length === 0) return
    setLoading(true)
    setError(null)

    const result = await generateAssessmentAction(selectedIndicator, selectedTypes, numQuestions)

    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.push(`/assessment/${result.assessmentId}`)
  }

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-medium">Generate an assessment</h1>

      <label className="mb-1 block text-sm font-medium">Curriculum indicator</label>
      <select
        className="mb-4 w-full rounded-md border p-2 text-sm"
        value={selectedIndicator}
        onChange={(e) => setSelectedIndicator(e.target.value)}
      >
        <option value="">Choose one…</option>
        {indicators.map((ind) => (
          <option key={ind.id} value={ind.id}>
            {ind.subjects.name} ({ind.subjects.class_level}) — {ind.indicator_text}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-sm font-medium">Question types</label>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {QUESTION_TYPE_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedTypes.includes(opt.value)}
              onChange={() => toggleType(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <label className="mb-1 block text-sm font-medium">Number of questions</label>
      <input
        type="number"
        min={1}
        max={20}
        value={numQuestions}
        onChange={(e) => setNumQuestions(Number(e.target.value))}
        className="mb-6 w-24 rounded-md border p-2 text-sm"
      />

      <Button onClick={handleGenerate} disabled={loading} className="w-full">
        {loading ? 'Generating…' : 'Generate assessment'}
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
    </>
  )
}
