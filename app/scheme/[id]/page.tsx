// Purpose: Displays a generated scheme of learning as a week-by-week table.
// Folder: app/scheme/[id]/page.tsx

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'

export default async function SchemeViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: scheme } = await supabase
    .from('schemes_of_learning')
    .select('id, term, academic_year, content, subjects(name, class_level)')
    .eq('id', id)
    .single()

  if (!scheme) notFound()

  const weeks = (scheme.content as any).weeks as {
    week_number: number
    indicators: { strand: string; sub_strand: string; indicator_text: string }[]
    focus_summary: string
  }[]

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-3xl py-10 px-6">
      <p className="text-sm text-muted-foreground">
        {(scheme.subjects as any).name} · {(scheme.subjects as any).class_level}
      </p>
      <h1 className="mb-6 text-xl font-medium">{scheme.term} — {scheme.academic_year}</h1>

      <div className="space-y-4">
        {weeks.map((week) => (
          <div key={week.week_number} className="rounded-lg border p-4">
            <div className="mb-2 text-sm font-medium">Week {week.week_number}</div>
            {week.focus_summary && (
              <p className="mb-3 text-sm text-muted-foreground">{week.focus_summary}</p>
            )}
            <ul className="ml-4 list-disc text-sm">
              {week.indicators.map((ind, i) => (
                <li key={i}>{ind.strand} / {ind.sub_strand}: {ind.indicator_text}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
    </>
  )
}

// Testing steps:
// 1. Visit /scheme/<a generated scheme id>.
// 2. Expected: one card per week, in order, each listing its real
//    indicator(s) and (if the AI call succeeded) a short focus summary.
