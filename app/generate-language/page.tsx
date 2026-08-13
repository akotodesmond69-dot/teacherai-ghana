// Purpose: A dedicated Lesson Generator screen scoped to Local Ghanaian
// Languages (Twi, Fante, Ga) and French. WHY this can simply reuse
// generateLessonAction from the main Generator (app/generate/actions.ts)
// unchanged: that action already works for any curriculum indicator
// regardless of subject — there's nothing Math/Science/English-specific
// baked into it. This page is purely a filtered picker UI.
// Folder: app/generate-language/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateLessonAction } from '@/app/generate/actions'
import { Button } from '@/components/ui/button'
import { AppNav } from '@/components/app-nav'

const LANGUAGE_SUBJECTS = ['Twi', 'Fante', 'Ga', 'French']

interface IndicatorOption {
  id: string
  indicator_text: string
  indicator_code: string
  strand: string
  sub_strand: string
  subjects: { name: string; class_level: string }
}

export default function GenerateLanguagePage() {
  const supabase = createClient()
  const router = useRouter()

  const [indicators, setIndicators] = useState<IndicatorOption[]>([])
  const [language, setLanguage] = useState('Twi')
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('curriculum_indicators')
        .select('id, indicator_text, indicator_code, strand, sub_strand, subjects(name, class_level)')
      if (data) setIndicators((data as unknown as IndicatorOption[]).filter((i) =>
        LANGUAGE_SUBJECTS.includes(i.subjects.name)
      ))
    }
    load()
  }, [])

  const filtered = indicators.filter((i) => i.subjects.name === language)

  async function handleGenerate() {
    if (!selectedId) return
    setLoading(true)
    setError(null)
    const result = await generateLessonAction(selectedId)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    router.push(`/dashboard?generated=${result.lessonId}`)
  }

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="mb-1 text-2xl font-medium">Local Languages &amp; French</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Generate a lesson note for Twi, Fante, Ga, or French — grounded in
          the real NaCCA Ghanaian Language and Culture / French curriculum.
        </p>

        <label className="mb-1 block text-sm font-medium">Language</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {LANGUAGE_SUBJECTS.map((lang) => (
            <button
              key={lang}
              onClick={() => { setLanguage(lang); setSelectedId('') }}
              className={`rounded-full px-3 py-1 text-xs ${
                language === lang ? 'bg-chalkboard text-white' : 'border border-neutral-300'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-sm font-medium">Curriculum indicator</label>
        <div className="mb-6 space-y-2">
          {filtered.map((ind) => (
            <label
              key={ind.id}
              className={`block cursor-pointer rounded-lg border p-4 text-sm ${
                selectedId === ind.id ? 'border-2 border-emerald-700' : 'border-neutral-300'
              }`}
            >
              <input
                type="radio"
                name="indicator"
                checked={selectedId === ind.id}
                onChange={() => setSelectedId(ind.id)}
                className="mr-2"
              />
              <span className="font-medium">{ind.subjects.class_level}</span>
              <br />
              <span className="text-muted-foreground">
                {ind.strand} → {ind.sub_strand} — {ind.indicator_text}
              </span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No {language} indicators loaded yet.
            </p>
          )}
        </div>

        <Button onClick={handleGenerate} disabled={!selectedId || loading} className="w-full">
          {loading ? 'Generating…' : 'Generate lesson note'}
        </Button>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </>
  )
}

// Testing steps:
// 1. Visit /generate-language, pick "Twi". Expected: the real seeded Twi
//    indicators appear.
// 2. Switch to "French". Expected: the one seeded French JHS 1 indicator
//    appears instead.
// 3. Generate a lesson — should work identically to the main Generator,
//    since it's the same underlying action.
