// Purpose: Lets a teacher submit a curriculum indicator that isn't in the
// database yet — either under an existing subject, or a brand new one.
// New submissions are immediately visible to every teacher, but marked
// is_verified = false until an admin reviews them.
// Folder: app/curriculum/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

export interface SubmitIndicatorInput {
  subjectId: string | null      // an existing subject's id, OR...
  newSubjectName: string | null // ...a brand new subject name (one of the two)
  newClassLevel: string | null  // required if newSubjectName is used
  strand: string
  subStrand: string
  contentStandard: string
  indicatorText: string
  indicatorCode: string // optional — teacher may not know the official code
}

export async function submitCurriculumIndicatorAction(input: SubmitIndicatorInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to add a curriculum indicator.' }

  if (!input.strand || !input.subStrand || !input.indicatorText) {
    return { error: 'Strand, sub-strand, and indicator text are required.' }
  }

  // Resolve the subject: use an existing one, or create a new one.
  let subjectId = input.subjectId
  if (!subjectId) {
    if (!input.newSubjectName || !input.newClassLevel) {
      return { error: 'Choose an existing subject, or provide a new subject name and class.' }
    }
    const { data: newSubject, error: subjectError } = await supabase
      .from('subjects')
      .insert({ name: input.newSubjectName, class_level: input.newClassLevel })
      .select('id')
      .single()

    if (subjectError || !newSubject) {
      console.error('submitCurriculumIndicatorAction: failed to create subject:', subjectError)
      return { error: 'Could not create the new subject.' }
    }
    subjectId = newSubject.id
  }

  // WHY we generate a fallback code: indicator_code is unique and required
  // (Phase 3 schema). A teacher submitting a topic they know but not the
  // exact official code shouldn't be blocked — we generate a clearly
  // non-official-looking placeholder instead of forcing them to invent one
  // that might collide with, or be mistaken for, a real NaCCA code.
  const indicatorCode = input.indicatorCode?.trim()
    || `COMMUNITY-${randomUUID().slice(0, 8).toUpperCase()}`

  const { data: newIndicator, error: indicatorError } = await supabase
    .from('curriculum_indicators')
    .insert({
      subject_id: subjectId,
      strand: input.strand,
      sub_strand: input.subStrand,
      content_standard: input.contentStandard || null,
      indicator_text: input.indicatorText,
      indicator_code: indicatorCode,
      created_by: user.id,
      is_verified: false, // always false for teacher submissions — an admin
                           // must verify it before it's treated as official
    })
    .select('id')
    .single()

  if (indicatorError || !newIndicator) {
    console.error('submitCurriculumIndicatorAction: failed to insert indicator:', indicatorError)
    return { error: 'Could not save the curriculum indicator. Please try again.' }
  }

  return { indicatorId: newIndicator.id }
}

// Testing steps:
// 1. Submit an indicator under an existing subject. Expected: success,
//    new row visible in curriculum_indicators with is_verified = false
//    and created_by = your teacher id.
// 2. Submit under a brand new subject name/class. Expected: both a new
//    subjects row and a new curriculum_indicators row are created.
// 3. Leave indicator code blank. Expected: a code like
//    "COMMUNITY-A1B2C3D4" is generated automatically.
// 4. Visit /generate as any teacher (not just the submitter). Expected:
//    the new indicator appears in the list, marked "Community" — confirms
//    it's visible to everyone, not just the person who added it.
