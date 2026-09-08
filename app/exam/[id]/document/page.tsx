// Purpose: Entry point for the exam Word Processor — Premium-gated (the
// real gate; server-side), fetches the exam plus the teacher's school
// branding (name + logo from Profile), and hands everything to the client
// view that hosts the actual rich-text editor.
// Folder: app/exam/[id]/document/page.tsx

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { AppNav } from '@/components/app-nav'
import { DocumentEditorView } from './document-editor-view'

export default async function ExamDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at, school_name, school_logo_url')
    .eq('id', user.id)
    .single()

  const isPremium = teacher ? hasActivePremium(teacher) : false

  if (!isPremium) {
    return (
      <>
        <AppNav />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="mb-2 text-2xl font-medium">Word Processor</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Format your exam freely — insert pictures, build tables, and
            print a document with your school's own logo and letterhead
            automatically added. This is a Premium feature.
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

  const { data: exam } = await supabase
    .from('exams')
    .select('id, teacher_id, class_level, content, document_json, subjects (name)')
    .eq('id', id)
    .single()

  if (!exam || exam.teacher_id !== user.id) notFound()

  return (
    <>
      <div className="print:hidden"><AppNav /></div>
      <DocumentEditorView
        examId={exam.id}
        meta={{ subjectName: (exam.subjects as any).name, classLevel: exam.class_level }}
        branding={{ schoolName: teacher?.school_name ?? null, schoolLogoUrl: teacher?.school_logo_url ?? null }}
        examContent={exam.content as any}
        savedDocumentJson={(exam.document_json as any) ?? null}
      />
    </>
  )
}

// Testing steps:
// 1. As a non-Premium teacher, visit /exam/<id>/document. Expected: the
//    upgrade prompt only, no editor loaded (and no exam data fetched).
// 2. As the owning Premium teacher with a school name + logo saved,
//    visit for the first time. Expected: the editor opens with the
//    letterhead and every question already laid out.
// 3. As a different teacher, visit another teacher's exam's document URL
//    directly. Expected: 404 — ownership is checked explicitly here (on
//    top of RLS), matching the pattern in app/exam/[id]/page.tsx.
