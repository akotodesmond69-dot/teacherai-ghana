// Purpose: Wraps every page under app/admin/*, redirecting anyone who
// isn't an admin. This is defense in depth on top of RLS — RLS already
// prevents non-admins from reading data they shouldn't, but redirecting
// them away entirely gives a cleaner experience than showing an empty
// dashboard full of "no data" states.
// Folder: app/admin/layout.tsx

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!teacher?.is_admin) redirect('/dashboard')

  return (
    <div className="mx-auto max-w-5xl py-8 px-6">
      <nav className="mb-6 flex gap-4 border-b pb-3 text-sm">
        <Link href="/admin">Overview</Link>
        <Link href="/admin/users">Teachers</Link>
        <Link href="/admin/curriculum">Curriculum</Link>
      </nav>
      {children}
    </div>
  )
}

// Testing steps:
// 1. Visit /admin as a non-admin teacher. Expected: redirected to /dashboard.
// 2. Visit /admin as the admin teacher (is_admin = true from the migration
//    above). Expected: the admin nav and page content load normally.
