// Purpose: Saves edited lesson content back to the database.
// Folder: app/lesson/[id]/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { LessonNoteContent } from '@/lib/ai/lessonSchema'

export async function saveLessonAction(lessonId: string, content: LessonNoteContent) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in to save changes.' }
  }

  // We don't need to check "is this my lesson" manually — Phase 3's RLS
  // update policy (auth.uid() = teacher_id) enforces it. If it's not their
  // lesson, this update simply affects zero rows.
  // Note: the { count: 'exact' } option belongs on .update() itself, not
  // on .select() — an easy mistake since count-related options can appear
  // on either read or write operations depending on the method.
  const { error, count } = await supabase
    .from('lesson_notes')
    .update({ content, updated_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', lessonId)
    .select('id')

  if (error) {
    return { error: 'Could not save your changes. Please try again.' }
  }
  if (count === 0) {
    return { error: 'Lesson not found, or you do not have permission to edit it.' }
  }

  return { success: true }
}

// Testing steps:
// 1. Edit a field in the editor, save. Expected: { success: true }, and
//    the change persists after refreshing the page.
// 2. Manually call this action with someone else's lesson id.
//    Expected: { error: 'Lesson not found...' } — RLS silently blocked
//    the update rather than throwing a scary error.
