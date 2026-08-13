// Purpose: Fetches one exam (RLS-protected, owner only) and hands it to
// the print-ready client view.
// Folder: app/exam/[id]/page.tsx

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { ExamView } from './exam-view'

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: exam } = await supabase
    .from('exams')
    .select('id, class_level, content, subjects (name)')
    .eq('id', id)
    .single()

  if (!exam) notFound()

  return (
    <>
      <div className="print:hidden"><AppNav /></div>
      <ExamView
        subjectName={(exam.subjects as any).name}
        classLevel={exam.class_level}
        content={exam.content as any}
      />
    </>
  )
}

// Testing steps:
// 1. Visit /exam/<a real exam id>. Expected: full exam paper renders.
// 2. Log in as a different teacher, visit the same URL directly.
//    Expected: 404 — RLS blocks it, same pattern as lessons/assessments.
