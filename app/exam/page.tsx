// Purpose: Entry point for the Exam Generator — checks Premium status
// server-side (the real gate; the UI is just a courtesy), fetches BOTH the
// teacher's own lessons and the full curriculum indicator list, and hands
// them to the tabbed picker so a teacher can build an exam from either
// source.
// Folder: app/exam/page.tsx

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { AppNav } from '@/components/app-nav'
import { ExamPickerTabs } from './picker-tabs'

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
            Build a full, ready-to-print exam — either a standard paper
            straight from the curriculum for a grade, or from your own
            generated lessons — correctly structured for Basic 1–3, Basic
            4–6, or JHS (BECE standard). Edit every question and export to
            PDF or Word. This is a Premium feature.
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

  const { data: indicators } = await supabase
    .from('curriculum_indicators')
    .select('id, indicator_text, indicator_code, strand, sub_strand, is_verified, subject_id, subjects (name, class_level)')

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-2xl py-10 px-6">
        <h1 className="mb-1 text-2xl font-medium">Exam Generator</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Build a standard exam straight from the curriculum for a grade, or
          from lessons you've already generated. You can edit every
          question before exporting to PDF or Word.
        </p>
        <ExamPickerTabs
          lessons={(lessons ?? []) as any}
          indicators={(indicators ?? []) as any}
        />
      </div>
    </>
  )
}

// Testing steps:
// 1. As a non-Premium teacher, visit /exam. Expected: the upgrade prompt,
//    no picker at all.
// 2. As a Premium teacher with zero lessons generated yet. Expected: the
//    "Standard exam from curriculum" tab is usable immediately; the "From
//    my own lessons" tab shows its own "generate a lesson first" message.
// 3. As a Premium teacher with lessons across 2+ subjects. Expected: both
//    tabs let you filter to one subject/class combo at a time.
