// Purpose: Persists a teacher's Word Processor document (Tiptap JSON) for
// an exam — separate from saveExamAction (app/exam/actions.ts), which
// saves the structured question data instead. Same Premium gate and
// ownership check as the rest of the Exam Generator; no structural
// validation here, since this is free-form formatting, not exam question
// data with a required count/marks structure.
// Folder: app/exam/[id]/document/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import type { JSONContent } from '@tiptap/core'

export async function saveExamDocumentAction(examId: string, documentJson: JSONContent) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to save changes.' }

  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', user.id)
    .single()

  if (teacherError || !teacher) return { error: 'Could not load your account. Please try again.' }
  if (!hasActivePremium(teacher)) return { error: 'The Word Processor is a Premium feature.' }

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id')
    .eq('id', examId)
    .single()

  if (examError || !exam) return { error: 'Exam not found.' }
  if (exam.teacher_id !== user.id) return { error: 'You do not have permission to edit this exam.' }

  // WHY no size cap enforced here beyond Postgres's own jsonb limits:
  // images are already resized/compressed client-side before insertion
  // (lib/tiptap/resizeImage.ts), which is where the real constraint
  // belongs — rejecting an already-oversized save would just lose a
  // teacher's edits with no way to fix it after the fact.
  const { error: updateError } = await supabase
    .from('exams')
    .update({ document_json: documentJson, document_updated_at: new Date().toISOString() })
    .eq('id', examId)
    .eq('teacher_id', user.id)

  if (updateError) {
    console.error('saveExamDocumentAction: failed to save document:', updateError)
    return { error: 'Could not save your changes. Please try again.' }
  }

  return { success: true as const }
}

// Testing steps:
// 1. As a Premium teacher, edit the document, save, reload the page.
//    Expected: the exact formatting (fonts, images, tables) persists.
// 2. As a non-Premium teacher (or one whose subscription lapsed after
//    generating the exam), attempt to save. Expected: a clear Premium
//    error, no partial write.
// 3. As a different teacher entirely, call this action with someone
//    else's exam id. Expected: a permission error, no write.
