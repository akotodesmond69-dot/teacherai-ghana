// Purpose: Fetches one exam (RLS-protected, owner only) plus the viewing
// teacher's CURRENT Premium status, and hands both to the editor/export
// view. Premium is re-checked here (not just at generation time) because a
// teacher's subscription can lapse after an exam was already generated —
// editing and exporting should reflect their status now, same principle as
// hasActivePremium() being checked fresh everywhere else in the app.
// Folder: app/exam/[id]/page.tsx

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { AppNav } from '@/components/app-nav'
import { ExamView } from './exam-view'

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: exam } = await supabase
    .from('exams')
    .select('id, class_level, content, subjects (name)')
    .eq('id', id)
    .single()

  if (!exam) notFound()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', user.id)
    .single()

  const isPremium = teacher ? hasActivePremium(teacher) : false

  return (
    <>
      <div className="print:hidden"><AppNav /></div>
      <ExamView
        examId={exam.id}
        subjectName={(exam.subjects as any).name}
        classLevel={exam.class_level}
        content={exam.content as any}
        isPremium={isPremium}
      />
    </>
  )
}

// Testing steps:
// 1. Visit /exam/<a real exam id>. Expected: full exam paper renders, with
//    Edit/Download controls if you're currently Premium.
// 2. Log in as a different teacher, visit the same URL directly.
//    Expected: 404 — RLS blocks it, same pattern as lessons/assessments.
// 3. As a teacher whose subscription just lapsed, visit an exam generated
//    while they were Premium. Expected: the exam still displays and can
//    still be printed, but edit/export controls are replaced by the
//    upgrade notice.
