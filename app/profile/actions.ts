// Purpose: Server actions for the Teacher Profile page — updating basic
// info and saving the weekly timetable. Avatar upload happens directly
// from the client (Supabase Storage) since it's a file upload, not
// something a server action needs to broker.
// Folder: app/profile/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateProfileAction(fullName: string, schoolName: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in.' }

  const { error } = await supabase
    .from('teachers')
    .update({ full_name: fullName, school_name: schoolName })
    .eq('id', user.id)

  if (error) {
    console.error('updateProfileAction failed:', error)
    return { error: 'Could not save your profile.' }
  }
  revalidatePath('/profile')
  return { success: true }
}

export interface TimetableEntryInput {
  day_of_week: string
  period_label: string
  subject_label: string
  class_label: string
}

export async function saveTimetableAction(entries: TimetableEntryInput[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in.' }

  // WHY delete-then-insert rather than trying to diff and update: a
  // teacher's timetable is small (a handful of periods a day) and edited
  // as a whole grid at once — replacing it entirely each save is simpler
  // and less error-prone than reconciling individual row changes.
  await supabase.from('timetable_entries').delete().eq('teacher_id', user.id)

  const rowsToInsert = entries
    .filter((e) => e.subject_label.trim() !== '')
    .map((e) => ({ ...e, teacher_id: user.id }))

  if (rowsToInsert.length > 0) {
    const { error } = await supabase.from('timetable_entries').insert(rowsToInsert)
    if (error) {
      console.error('saveTimetableAction failed:', error)
      return { error: 'Could not save your timetable.' }
    }
  }

  revalidatePath('/profile')
  return { success: true }
}

export async function updateAvatarUrlAction(avatarUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in.' }

  const { error } = await supabase
    .from('teachers')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id)

  if (error) {
    console.error('updateAvatarUrlAction failed:', error)
    return { error: 'Could not save your photo.' }
  }
  revalidatePath('/profile')
  return { success: true }
}
