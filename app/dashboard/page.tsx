// Purpose: Shows a teacher's real saved lessons (replaces Phase 2's static mockup).
// Folder: app/dashboard/page.tsx
// Depends on: lib/supabase/server.ts
// This is a Server Component — no 'use client' — because it only reads data
// once on page load; nothing here needs interactivity.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { AppNav } from '@/components/app-nav'

const FREE_TIER_MONTHLY_LIMIT = 5

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login') // belt-and-suspenders — middleware already does this

  const [{ data: teacher }, { data: lessons }] = await Promise.all([
    supabase
      .from('teachers')
      .select('subscription_tier, subscription_expires_at, lessons_used_this_month')
      .eq('id', user.id)
      .single(),
    supabase
      .from('lesson_notes')
      .select('id, created_at, curriculum_indicators(indicator_text, strand, sub_strand, subjects(name, class_level))')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  const usedThisMonth = teacher?.lessons_used_this_month ?? 0
  const isPremium = teacher ? hasActivePremium(teacher) : false

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-4xl py-10 px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium">Your lessons</h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {isPremium ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
              Premium active until{' '}
              {new Date(teacher!.subscription_expires_at!).toLocaleDateString()}
            </span>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">
                {usedThisMonth} of {FREE_TIER_MONTHLY_LIMIT} lessons used this month
              </span>
              <Link href="/billing" className="text-sm text-info-blue underline">
                Upgrade to Premium
              </Link>
            </>
          )}
          <Link
            href="/generate"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950"
          >
            + Generate new lesson
          </Link>
        </div>
      </div>

      {!lessons || lessons.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-sm text-muted-foreground">
          No lessons yet — generate your first one to see it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((lesson: any) => (
            <Link
              key={lesson.id}
              href={`/lesson/${lesson.id}`}
              className="rounded-lg border border-neutral-200 bg-white p-4 hover:border-neutral-400"
            >
              <div className="mb-2 inline-block rounded-full bg-amber-100 px-3 py-0.5 text-xs text-amber-800">
                {lesson.curriculum_indicators.subjects.name} ·{' '}
                {lesson.curriculum_indicators.subjects.class_level}
              </div>
              <div className="mb-1 text-sm font-medium">
                {lesson.curriculum_indicators.indicator_text}
              </div>
              <div className="text-xs text-muted-foreground">
                Created {new Date(lesson.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
      </div>
    </>
  )
}

// ----------------------------------------------------------------------------
// Testing steps:
// 1. Log in as a teacher who has generated at least one lesson (Phase 6).
// 2. Visit /dashboard. Expected: a real card for each of their lessons,
//    with the correct subject/class tag and indicator text.
// 3. Log in as a brand new teacher with zero lessons.
//    Expected: the "No lessons yet" empty state, not a blank page or error.
//
// Common error: "Cannot read properties of null (reading 'subjects')"
// Fix: this means a lesson_notes row points to an indicator that was
// deleted — shouldn't happen given Phase 3's `on delete restrict` on that
// foreign key, but if you see it, check for manually deleted seed data.
// ----------------------------------------------------------------------------
