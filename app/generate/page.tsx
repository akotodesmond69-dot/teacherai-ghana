// Purpose: The real Lesson Generator screen — lets a teacher pick a class
// band, subject, and curriculum indicator, then generates a lesson note.
// Folder: app/generate/page.tsx
// Depends on: lib/supabase/client.ts, ./actions.ts, shadcn/ui components
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { generateLessonAction } from './actions'
import { getClassBand, BAND_LABELS, BAND_ORDER, type ClassBand } from '@/lib/curriculum/bands'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/app-nav'

interface IndicatorOption {
  id: string
  indicator_text: string
  indicator_code: string
  strand: string
  sub_strand: string
  is_verified: boolean
  subjects: { name: string; class_level: string }
}

export default function GeneratePage() {
  const supabase = createClient()
  const router = useRouter()

  const [indicators, setIndicators] = useState<IndicatorOption[]>([])
  const [band, setBand] = useState<ClassBand>('upper_primary')
  const [subjectKey, setSubjectKey] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadIndicators() {
      const { data } = await supabase
        .from('curriculum_indicators')
        .select('id, indicator_text, indicator_code, strand, sub_strand, is_verified, subjects(name, class_level)')
      if (data) setIndicators(data as unknown as IndicatorOption[])
    }
    loadIndicators()
  }, [])

  // Group by band, then by "subject + class" within that band — this is
  // what actually makes 70+ indicators navigable instead of one long list.
  const bandsWithSubjects = useMemo(() => {
    const map = new Map<ClassBand, Map<string, { label: string; items: IndicatorOption[] }>>()
    for (const ind of indicators) {
      const b = getClassBand(ind.subjects.class_level)
      const key = `${ind.subjects.name}__${ind.subjects.class_level}`
      if (!map.has(b)) map.set(b, new Map())
      const subjMap = map.get(b)!
      if (!subjMap.has(key)) {
        subjMap.set(key, { label: `${ind.subjects.name} · ${ind.subjects.class_level}`, items: [] })
      }
      subjMap.get(key)!.items.push(ind)
    }
    return map
  }, [indicators])

  const subjectsInBand = bandsWithSubjects.get(band)
  const activeSubjectKey = subjectKey || Array.from(subjectsInBand?.keys() ?? [])[0] || ''
  const activeIndicators = subjectsInBand?.get(activeSubjectKey)?.items ?? []

  async function handleGenerate() {
    if (!selectedId) return
    setLoading(true)
    setError(null)

    const result = await generateLessonAction(selectedId)

    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.push(`/dashboard?generated=${result.lessonId}`)
  }

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="mb-1 text-2xl font-medium">Generate a lesson note</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Choose a class group, subject, and curriculum indicator.
        </p>

        <label className="mb-1 block text-sm font-medium">Class group</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {BAND_ORDER.filter((b) => bandsWithSubjects.has(b)).map((b) => (
            <button
              key={b}
              onClick={() => { setBand(b); setSubjectKey(''); setSelectedId('') }}
              className={`rounded-full px-3 py-1 text-xs ${
                band === b ? 'bg-chalkboard text-white' : 'border border-neutral-300'
              }`}
            >
              {BAND_LABELS[b]}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-sm font-medium">Subject</label>
        <select
          className="mb-4 w-full rounded-md border p-2 text-sm"
          value={activeSubjectKey}
          onChange={(e) => { setSubjectKey(e.target.value); setSelectedId('') }}
        >
          {Array.from(subjectsInBand?.entries() ?? []).map(([key, group]) => (
            <option key={key} value={key}>{group.label}</option>
          ))}
        </select>

        <label className="mb-1 block text-sm font-medium">Curriculum indicator</label>
        <div className="mb-4 space-y-2">
          {activeIndicators.map((ind) => (
            <label
              key={ind.id}
              className={`block cursor-pointer rounded-lg border p-4 text-sm ${
                selectedId === ind.id ? 'border-2 border-emerald-700' : 'border-neutral-300'
              }`}
            >
              <input
                type="radio"
                name="indicator"
                value={ind.id}
                checked={selectedId === ind.id}
                onChange={() => setSelectedId(ind.id)}
                className="mr-2"
              />
              {!ind.is_verified && (
                <span className="mr-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                  Community
                </span>
              )}
              <span className="text-muted-foreground">
                {ind.strand} → {ind.sub_strand} — {ind.indicator_text}
              </span>
            </label>
          ))}
          {activeIndicators.length === 0 && (
            <p className="text-sm text-muted-foreground">No indicators in this group yet.</p>
          )}
        </div>

        <Link
          href="/curriculum/new"
          className="mb-4 block text-center text-sm text-info-blue underline"
        >
          Don't see your topic? + Create Curriculum Indicator
        </Link>

        <Button
          onClick={handleGenerate}
          disabled={!selectedId || loading}
          className="w-full"
        >
          {loading ? 'Generating…' : 'Generate lesson note'}
        </Button>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </>
  )
}

// Testing steps:
// 1. Visit /generate. Expected: class-group tabs (only bands that actually
//    have data show up), a subject dropdown scoped to that band, and an
//    indicator list scoped to that subject — not one long flat list.
// 2. Switch class group — subject dropdown and indicator list should
//    update and the previous selection should clear.
