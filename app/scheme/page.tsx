// Purpose: Lets a teacher pick a subject/term and generate a scheme of learning.
// Folder: app/scheme/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateSchemeAction } from './actions'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/app-nav'

export default function SchemeGeneratorPage() {
  const supabase = createClient()
  const router = useRouter()

  const [subjects, setSubjects] = useState<any[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [term, setTerm] = useState('Term 1')
  const [academicYear, setAcademicYear] = useState('2025/2026')
  const [numWeeks, setNumWeeks] = useState(12)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('subjects').select('id, name, class_level').then(({ data }) => data && setSubjects(data))
  }, [])

  async function handleGenerate() {
    if (!subjectId) return
    setLoading(true)
    setError(null)

    const result = await generateSchemeAction(subjectId, term, academicYear, numWeeks)

    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.push(`/scheme/${result.schemeId}`)
  }

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-6 text-2xl font-medium">Generate a scheme of learning</h1>

      <label className="mb-1 block text-sm font-medium">Subject</label>
      <select
        className="mb-4 w-full rounded-md border p-2 text-sm"
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
      >
        <option value="">Choose one…</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({s.class_level})</option>
        ))}
      </select>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Term</label>
          <select className="w-full rounded-md border p-2 text-sm" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option>Term 1</option>
            <option>Term 2</option>
            <option>Term 3</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Academic year</label>
          <input
            className="w-full rounded-md border p-2 text-sm"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
          />
        </div>
      </div>

      <label className="mb-1 block text-sm font-medium">Number of weeks in the term</label>
      <input
        type="number"
        min={1}
        max={16}
        value={numWeeks}
        onChange={(e) => setNumWeeks(Number(e.target.value))}
        className="mb-6 w-24 rounded-md border p-2 text-sm"
      />

      <Button onClick={handleGenerate} disabled={loading} className="w-full">
        {loading ? 'Generating…' : 'Generate scheme of learning'}
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
    </>
  )
}
