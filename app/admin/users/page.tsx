// Purpose: Lists every teacher on the platform with their tier and usage.
// Read-only for MVP — see the note in Phase 12's write-up for why.
// Folder: app/admin/users/page.tsx

import { createClient } from '@/lib/supabase/server'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, school_name, subscription_tier, lessons_used_this_month, created_at')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-medium">Teachers</h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="py-2 pr-4">School</th>
              <th className="py-2 pr-4">Tier</th>
              <th className="py-2 pr-4">Lessons this month</th>
              <th className="py-2">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(teachers ?? []).map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2 pr-4">{t.school_name ?? '—'}</td>
                <td className="py-2 pr-4 capitalize">{t.subscription_tier}</td>
                <td className="py-2 pr-4">{t.lessons_used_this_month}</td>
                <td className="py-2">{new Date(t.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Testing steps:
// 1. Visit /admin/users as an admin. Expected: every teacher on the
//    platform appears, including ones you didn't create yourself —
//    confirms the admin RLS policy is working across accounts, not just
//    showing "your own" data.
