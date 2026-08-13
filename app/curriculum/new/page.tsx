// Purpose: Form for a teacher to submit a curriculum indicator that isn't
// in the list on the Generator page.
// Folder: app/curriculum/new/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitCurriculumIndicatorAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AppNav } from '@/components/app-nav'

export default function NewCurriculumIndicatorPage() {
  const supabase = createClient()
  const router = useRouter()

  const [subjects, setSubjects] = useState<{ id: string; name: string; class_level: string }[]>([])
  const [subjectId, setSubjectId] = useState('')
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newClassLevel, setNewClassLevel] = useState('')
  const [strand, setStrand] = useState('')
  const [subStrand, setSubStrand] = useState('')
  const [contentStandard, setContentStandard] = useState('')
  const [indicatorText, setIndicatorText] = useState('')
  const [indicatorCode, setIndicatorCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('subjects').select('id, name, class_level').then(({ data }) => data && setSubjects(data))
  }, [])

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const result = await submitCurriculumIndicatorAction({
      subjectId: subjectId || null,
      newSubjectName: subjectId ? null : newSubjectName,
      newClassLevel: subjectId ? null : newClassLevel,
      strand,
      subStrand,
      contentStandard,
      indicatorText,
      indicatorCode,
    })

    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    // Send them straight to the Generator with the new indicator ready to use.
    router.push('/generate')
  }

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="mb-1 text-2xl font-medium">Add a curriculum indicator</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Don't see your topic in the list? Add it here — it'll be available to
        every teacher using the app, marked as a community submission until
        an admin verifies it against the official NaCCA document.
      </p>

      <Label className="mb-1 block text-sm font-medium">Subject</Label>
      <select
        className="mb-2 w-full rounded-md border p-2 text-sm"
        value={subjectId}
        onChange={(e) => setSubjectId(e.target.value)}
      >
        <option value="">— Add a new subject instead —</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({s.class_level})</option>
        ))}
      </select>

      {!subjectId && (
        <div className="mb-4 grid grid-cols-2 gap-3 rounded-md border border-dashed p-3">
          <div>
            <Label className="mb-1 block text-xs">New subject name</Label>
            <Input value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} placeholder="e.g. French" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Class</Label>
            <Input value={newClassLevel} onChange={(e) => setNewClassLevel(e.target.value)} placeholder="e.g. Basic 5" />
          </div>
        </div>
      )}

      <Label className="mb-1 block text-sm font-medium">Strand</Label>
      <Input className="mb-3" value={strand} onChange={(e) => setStrand(e.target.value)} />

      <Label className="mb-1 block text-sm font-medium">Sub-strand</Label>
      <Input className="mb-3" value={subStrand} onChange={(e) => setSubStrand(e.target.value)} />

      <Label className="mb-1 block text-sm font-medium">Content standard</Label>
      <Textarea className="mb-3" rows={2} value={contentStandard} onChange={(e) => setContentStandard(e.target.value)} />

      <Label className="mb-1 block text-sm font-medium">Indicator (performance indicator text)</Label>
      <Textarea className="mb-3" rows={2} value={indicatorText} onChange={(e) => setIndicatorText(e.target.value)} />

      <Label className="mb-1 block text-sm font-medium">Indicator code (optional — leave blank if unsure)</Label>
      <Input className="mb-6" value={indicatorCode} onChange={(e) => setIndicatorCode(e.target.value)} placeholder="e.g. B4.1.3.2.1" />

      <Button onClick={handleSubmit} disabled={loading} className="w-full">
        {loading ? 'Adding…' : 'Add curriculum indicator'}
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
    </>
  )
}

// Testing steps:
// 1. Pick an existing subject, fill in strand/sub-strand/indicator, submit.
//    Expected: redirected to /generate, new indicator visible in the list.
// 2. Leave subject blank, fill in "New subject name" and "Class" instead.
//    Expected: a new subject AND indicator are both created.
