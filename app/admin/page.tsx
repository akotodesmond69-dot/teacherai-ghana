// Purpose: Platform-wide analytics — how many teachers, how much content
// generated, subscription breakdown.
// Folder: app/admin/page.tsx
// Note: because the admin layout already confirmed this user is an admin,
// and the Phase 12 RLS policies grant admins read access across teachers'
// content, these queries simply work — no special "admin mode" flag needed
// in the queries themselves.

import { createClient } from '@/lib/supabase/server'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const [
    { count: totalTeachers },
    { count: freeTeachers },
    { count: paidTeachers },
    { count: totalLessons },
    { count: totalAssessments },
    { count: totalSchemes },
  ] = await Promise.all([
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'free'),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'paid'),
    supabase.from('lesson_notes').select('*', { count: 'exact', head: true }),
    supabase.from('assessments').select('*', { count: 'exact', head: true }),
    supabase.from('schemes_of_learning').select('*', { count: 'exact', head: true }),
  ])

  const stats = [
    { label: 'Total teachers', value: totalTeachers ?? 0 },
    { label: 'Free tier', value: freeTeachers ?? 0 },
    { label: 'Paid tier', value: paidTeachers ?? 0 },
    { label: 'Lessons generated', value: totalLessons ?? 0 },
    { label: 'Assessments generated', value: totalAssessments ?? 0 },
    { label: 'Schemes generated', value: totalSchemes ?? 0 },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium">Platform overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border p-4">
            <div className="text-2xl font-medium">{s.value}</div>
            <div className="text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Testing steps:
// 1. Visit /admin as an admin. Expected: six numbers, all matching what
//    you'd count manually in Supabase's Table Editor.
// 2. Generate a new lesson as any teacher, refresh /admin.
//    Expected: "Lessons generated" increments by 1.
//
// Common error: counts show 0 even though data clearly exists
// Fix: almost always means the Phase 12 admin SELECT policies weren't
// applied, or this teacher's is_admin flag isn't actually set to true —
// RLS silently returns zero rows rather than an error when access is denied.
