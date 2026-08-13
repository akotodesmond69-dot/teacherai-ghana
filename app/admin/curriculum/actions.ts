// Purpose: Lets an admin mark a community-submitted curriculum indicator
// as verified, or delete it if it's wrong/inappropriate.
// Folder: app/admin/curriculum/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function verifyIndicatorAction(indicatorId: string) {
  const supabase = await createClient()

  // Not re-checking is_admin here on purpose — the Phase 12 RLS policy
  // ("Admins can update curriculum indicators") already enforces this at
  // the database level. If a non-admin somehow calls this action, the
  // update below simply affects zero rows.
  const { error } = await supabase
    .from('curriculum_indicators')
    .update({ is_verified: true })
    .eq('id', indicatorId)

  if (error) return { error: 'Could not verify this indicator.' }

  revalidatePath('/admin/curriculum')
  return { success: true }
}

export async function deleteIndicatorAction(indicatorId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('curriculum_indicators')
    .delete()
    .eq('id', indicatorId)

  if (error) {
    // Most likely cause: a lesson_notes/assessments/schemes row already
    // references this indicator (on delete restrict from Phase 3) —
    // meaning a teacher already generated a real lesson from it, so we
    // deliberately don't allow deleting it out from under them.
    return { error: 'Could not delete — it may already be in use by a generated lesson.' }
  }

  revalidatePath('/admin/curriculum')
  return { success: true }
}
