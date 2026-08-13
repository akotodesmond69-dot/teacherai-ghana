// Purpose: Displays a generated assessment. Read-only for MVP — editing
// assessments is a natural future upgrade, same pattern as the Lesson Editor.
// Folder: app/assessment/[id]/page.tsx

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { AssessmentContent } from '@/lib/ai/assessmentSchema'
import { AppNav } from '@/components/app-nav'

export default async function AssessmentViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: assessment } = await supabase
    .from('assessments')
    .select('id, content')
    .eq('id', id)
    .single()

  if (!assessment) notFound()

  const content = assessment.content as AssessmentContent

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-2xl py-10 px-6">
      <h1 className="mb-2 text-xl font-medium">{content.title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{content.instructions}</p>

      <div className="space-y-5">
        {content.questions.map((q, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
              <span>{q.type.replace('_', ' ')} · Bloom's: {q.bloom_level}</span>
              <span>{q.marks} marks</span>
            </div>
            <p className="mb-2 text-sm font-medium">{i + 1}. {q.question_text}</p>
            {q.options && (
              <ul className="ml-4 list-disc text-sm text-muted-foreground">
                {q.options.map((opt, j) => <li key={j}>{opt}</li>)}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg bg-neutral-50 p-4">
        <p className="mb-1 text-sm font-medium">Marking scheme</p>
        <p className="text-sm text-muted-foreground">{content.marking_scheme}</p>
        {content.rubric && (
          <>
            <p className="mb-1 mt-3 text-sm font-medium">Rubric</p>
            <p className="text-sm text-muted-foreground">{content.rubric}</p>
          </>
        )}
      </div>
    </div>
    </>
  )
}
