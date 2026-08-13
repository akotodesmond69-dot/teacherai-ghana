// Purpose: Teacher Profile page — name, school, email, lessons generated
// count, timetable, and avatar.
// Folder: app/profile/page.tsx

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/app-nav'
import { ProfileEditor } from './profile-editor'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: teacher }, { count: lessonsCount }, { data: timetable }] = await Promise.all([
    supabase.from('teachers').select('full_name, school_name, avatar_url').eq('id', user.id).single(),
    supabase.from('lesson_notes').select('*', { count: 'exact', head: true }).eq('teacher_id', user.id),
    supabase.from('timetable_entries').select('*').eq('teacher_id', user.id),
  ])

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="mb-6 text-2xl font-medium">My Profile</h1>
        <ProfileEditor
          fullName={teacher?.full_name ?? ''}
          schoolName={teacher?.school_name ?? ''}
          avatarUrl={teacher?.avatar_url ?? null}
          email={user.email ?? ''}
          lessonsCount={lessonsCount ?? 0}
          timetable={(timetable ?? []) as any}
        />
      </div>
    </>
  )
}

// Testing steps:
// 1. Visit /profile. Expected: your real email (read-only, since it comes
//    from auth, not a field you edit here), lessons generated count,
//    editable name/school fields, an avatar uploader, and a timetable grid.
