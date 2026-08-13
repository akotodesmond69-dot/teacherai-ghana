// Purpose: Fetches one lesson note and hands it to the client-side editor,
// including the full curriculum context (strand, sub-strand, content
// standard, indicator code) needed for the real lesson plan book format.
// Folder: app/lesson/[id]/page.tsx
// Depends on: lib/supabase/server.ts, ./editor.tsx
// Security note: we don't need to manually check "does this lesson belong
// to this teacher" here — Phase 3's RLS policy already guarantees that.
// If another teacher's id is put in the URL, this query simply returns
// no row, and we show "not found" rather than someone else's lesson.

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { LessonEditor } from './editor'
import { AppNav } from '@/components/app-nav'

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login') // belt-and-suspenders — middleware already does this

  const [{ data: lesson }, { data: teacher }] = await Promise.all([
    supabase
      .from('lesson_notes')
      .select(`
        id, content,
        curriculum_indicators (
          strand, sub_strand, content_standard, indicator_text, indicator_code,
          subjects (name, class_level)
        )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('teachers')
      .select('subscription_tier, subscription_expires_at')
      .eq('id', user.id)
      .single(),
  ])

  if (!lesson) notFound()

  const indicator = lesson.curriculum_indicators as any
  const isPremium = teacher ? hasActivePremium(teacher) : false

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-3xl py-10 px-6">
        <p className="mb-1 text-sm text-muted-foreground">
          {indicator.subjects.name} · {indicator.subjects.class_level}
        </p>
        <h1 className="mb-6 text-xl font-medium">{indicator.indicator_text}</h1>
        <LessonEditor
          lessonId={lesson.id}
          initialContent={lesson.content}
          subjectName={indicator.subjects.name}
          classLevel={indicator.subjects.class_level}
          strand={indicator.strand}
          subStrand={indicator.sub_strand}
          contentStandard={indicator.content_standard}
          indicatorText={indicator.indicator_text}
          indicatorCode={indicator.indicator_code}
          isPremium={isPremium}
        />
      </div>
    </>
  )
}

// Testing steps:
// 1. Visit /lesson/<a real id from your dashboard>. Expected: full lesson
//    plan loads, including strand/sub-strand/content standard/indicator
//    code shown read-only, plus the editable metadata and phase fields.
// 2. Visit /lesson/<a random fake uuid>. Expected: Next.js's built-in
//    404 "not found" page, not a crash.
// 3. Log in as teacher B, visit teacher A's lesson URL directly.
//    Expected: also 404 — this is RLS working, not a bug in this file.
// 4. As a non-Premium teacher, the "Download as Word" button should be
//    replaced with an upgrade prompt (see editor.tsx). As a Premium
//    teacher (or after a successful test payment), the real button appears.
