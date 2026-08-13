// Purpose: Fetches and displays one generated exercise, print-ready.
// Folder: app/exercises/[id]/page.tsx

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { ExerciseView } from './exercise-view'

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: exercise } = await supabase
    .from('exercises')
    .select('id, source_summary, content')
    .eq('id', id)
    .single()

  if (!exercise) notFound()

  return (
    <>
      <div className="print:hidden"><AppNav /></div>
      <ExerciseView sourceSummary={exercise.source_summary} content={exercise.content as any} />
    </>
  )
}
