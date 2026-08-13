// Purpose: The lesson editor, rebuilt to match the real Ghana Education
// Service lesson plan book format — header logistics fields, read-only
// curriculum data, and the three-phase lesson body.
// Folder: app/lesson/[id]/editor.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { saveLessonAction } from './actions'
import { generateLessonPdf } from '@/lib/pdf/generateLessonPdf'
import { generateLessonWord } from '@/lib/word/generateLessonWord'
import type { LessonNoteContent } from '@/lib/ai/lessonSchema'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// List-style fields are edited as one item per line, then split back into
// an array on save — same simple approach as before.
const LIST_FIELDS: (keyof LessonNoteContent)[] = ['core_competencies', 'key_words', 'tlrs']

const METADATA_FIELDS: { key: keyof LessonNoteContent; label: string }[] = [
  { key: 'week_number', label: 'Week' },
  { key: 'week_ending', label: 'Week Ending' },
  { key: 'class_size', label: 'Class Size' },
  { key: 'days', label: 'Day(s)' },
  { key: 'date', label: 'Date' },
  { key: 'period', label: 'Period' },
  { key: 'lesson_number', label: 'Lesson' },
]

const CONTENT_LABELS: Record<
  Exclude<keyof LessonNoteContent, keyof typeof METADATA_FIELDS[number]['key']>,
  string
> = {
  core_competencies: 'Core Competencies',
  key_words: 'Key Words',
  tlrs: 'T.L.R(s)  (Teaching and Learning Resources)',
  references: 'Ref',
  phase1_starter: 'Phase 1: Starter  (preparing the brain for learning)',
  phase2_main: 'Phase 2: Main  (new learning, including assessment)',
  phase3_plenary: 'Phase 3: Plenary / Reflections',
} as any

const CONTENT_ORDER: (keyof LessonNoteContent)[] = [
  'core_competencies', 'key_words', 'tlrs', 'references',
  'phase1_starter', 'phase2_main', 'phase3_plenary',
]

function toTextareaValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value
}

export function LessonEditor({
  lessonId,
  initialContent,
  subjectName,
  classLevel,
  strand,
  subStrand,
  contentStandard,
  indicatorText,
  indicatorCode,
  isPremium,
}: {
  lessonId: string
  initialContent: LessonNoteContent
  subjectName: string
  classLevel: string
  strand: string
  subStrand: string
  contentStandard: string | null
  indicatorText: string
  indicatorCode: string
  isPremium: boolean
}) {
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [downloadingWord, setDownloadingWord] = useState(false)

  function updateField(field: keyof LessonNoteContent, rawValue: string) {
    const isList = LIST_FIELDS.includes(field)
    setContent((prev) => ({
      ...prev,
      [field]: isList ? rawValue.split('\n') : rawValue,
    }))
    setSavedMessage(null)
  }

  async function handleSave() {
    setSaving(true)
    const result = await saveLessonAction(lessonId, content)
    setSaving(false)
    setSavedMessage(result.error ?? 'Saved ✓')
  }

  function handleDownloadPdf() {
    generateLessonPdf(
      {
        subjectName, classLevel, strand, subStrand,
        contentStandard, indicatorText, indicatorCode,
      },
      content
    )
  }

  // WHY isPremium is trusted here without a server round-trip: it was
  // determined server-side in page.tsx (using the real, RLS-protected
  // teachers row), then passed down as a prop — a teacher can't fake this
  // by editing browser code, since the actual page.tsx render already
  // decided whether to even pass isPremium: true in the first place. This
  // is different from, say, trusting a client-sent "isAdmin" flag, which
  // WOULD be forgeable.
  async function handleDownloadWord() {
    if (!isPremium) return
    setDownloadingWord(true)
    await generateLessonWord(
      { subjectName, classLevel, strand, subStrand, contentStandard, indicatorText, indicatorCode },
      content
    )
    setDownloadingWord(false)
  }

  return (
    <div className="space-y-8">
      {/* Header logistics fields — the lines a teacher fills in by hand on
          the paper version: Week, Class, Week Ending, Day, Date, Period */}
      <div className="rounded-lg border p-4">
        <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">
          Lesson Plan Details
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {METADATA_FIELDS.map((f) => (
            <div key={f.key}>
              <Label className="mb-1 block text-xs">{f.label}</Label>
              <Input
                value={content[f.key] as string}
                onChange={(e) => updateField(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Curriculum data — read-only, taken directly from the real
          indicator record (Phase 3/5), never editable here since it must
          stay verified and accurate. */}
      <div className="rounded-lg border bg-neutral-50 p-4 text-sm">
        <p className="mb-3 text-xs font-medium uppercase text-muted-foreground">
          Curriculum (from official NaCCA data — read only)
        </p>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Strand</dt><dd>{strand}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Sub-strand</dt><dd>{subStrand}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Indicator (code)</dt><dd>{indicatorCode}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Content standard</dt><dd>{contentStandard ?? '—'}</dd></div>
        </dl>
        <div className="mt-2">
          <dt className="text-xs text-muted-foreground">Performance indicator</dt>
          <dd>{indicatorText}</dd>
        </div>
      </div>

      {/* AI-generated lesson content, editable */}
      {CONTENT_ORDER.map((field) => (
        <div key={field}>
          <Label className="mb-1 block text-sm font-medium">
            {(CONTENT_LABELS as Record<string, string>)[field]}
          </Label>
          <Textarea
            value={toTextareaValue(content[field] as string | string[])}
            onChange={(e) => updateField(field, e.target.value)}
            rows={field.startsWith('phase') ? 5 : LIST_FIELDS.includes(field) ? 3 : 2}
          />
        </div>
      ))}

      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3 shadow-sm">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button variant="outline" onClick={handleDownloadPdf}>
          Download as PDF
        </Button>
        {isPremium ? (
          <Button variant="outline" onClick={handleDownloadWord} disabled={downloadingWord}>
            {downloadingWord ? 'Preparing…' : 'Download as Word'}
          </Button>
        ) : (
          <Link
            href="/billing"
            className="rounded-md border border-dashed border-amber-400 px-4 py-2 text-sm text-amber-700"
          >
            🔒 Word export — Premium only
          </Link>
        )}
        {savedMessage && <span className="text-sm text-muted-foreground">{savedMessage}</span>}
      </div>
    </div>
  )
}

// Testing steps:
// 1. Open a newly generated lesson. Expected: the header fields (Week,
//    Week Ending, Class Size, Day(s), Date, Period, Lesson) are empty and
//    editable; the curriculum box shows real strand/sub-strand/indicator
//    data, read-only; below that, core competencies, key words, T.L.R(s),
//    Ref, and the three phases are pre-filled by the AI and editable.
// 2. Fill in "Week Ending," save, refresh — confirms metadata persists
//    the same way generated content does.
// 3. Click "Download as PDF" — the PDF should include everything on
//    screen, including whatever you just typed into the header fields.
// 4. As a non-Premium teacher: "Download as Word" is replaced by a
//    dashed "Word export — Premium only" link to /billing.
// 5. As a Premium teacher (real payment or manually set in Supabase for
//    testing): the real "Download as Word" button appears and produces
//    an editable .docx file.
