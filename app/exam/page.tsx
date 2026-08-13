// Purpose: Entry point for the Exam Generator — checks Premium status
// server-side (the real gate; the UI is just a courtesy), fetches the
// teacher's own lessons, and hands them to the client-side picker.
// Folder: app/exam/page.tsx

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { AppNav } from '@/components/app-nav'
import { ExamPicker } from './picker'

export default async function ExamGeneratorPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', user.id)
    .single()

  const isPremium = teacher ? hasActivePremium(teacher) : false

  if (!isPremium) {
    return (
      <>
        <AppNav />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="mb-2 text-2xl font-medium">Exam Generator</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Build a full, ready-to-print exam from your own generated lessons —
            correctly structured for Basic 1–3, Basic 4–6, or JHS (BECE
            standard). This is a Premium feature.
          </p>
          <Link
            href="/billing"
            className="inline-block rounded-md bg-gold-thread px-6 py-3 text-sm font-medium text-amber-950"
          >
            Upgrade to Premium
          </Link>
        </div>
      </>
    )
  }

  const { data: lessons } = await supabase
    .from('lesson_notes')
    .select(`
      id, created_at,
      curriculum_indicators (
        indicator_text, subject_id,
        subjects (name, class_level)
      )
    `)
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-2xl py-10 px-6">
        <h1 className="mb-1 text-2xl font-medium">Exam Generator</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Pick a subject and class, then select the lessons to build the exam from.
        </p>
        <ExamPicker lessons={(lessons ?? []) as any} />
      </div>
    </>
  )
}

// Testing steps:
// 1. As a non-Premium teacher, visit /exam. Expected: the upgrade prompt,
//    no lesson list, no way to generate.
// 2. As a Premium teacher with zero lessons generated yet. Expected: the
//    picker loads but shows "no lessons yet" (handled inside ExamPicker).
// 3. As a Premium teacher with lessons across 2+ subjects. Expected: the
//    picker lets you filter to one subject/class combo at a time.
