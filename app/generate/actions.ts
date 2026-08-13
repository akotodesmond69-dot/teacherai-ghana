// Purpose: Server action that a button on the Generator page calls directly.
// Orchestrates: auth check -> usage limit check -> fetch indicator ->
// call AI -> save lesson -> increment usage count.
// Folder: app/generate/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { generateLessonNote } from '@/lib/ai/generateLessonNote'
import { emptyLessonMetadata } from '@/lib/ai/lessonSchema'

const FREE_TIER_MONTHLY_LIMIT = 5

export async function generateLessonAction(indicatorId: string) {
  const supabase = await createClient()

  // 1. Who is asking? (Phase 4's session handling makes this simple.)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be logged in to generate a lesson.' }
  }

  // 2. Have they hit their monthly limit? (Phase 1's MVP subscription rule.)
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at, lessons_used_this_month')
    .eq('id', user.id)
    .single()

  if (teacherError || !teacher) {
    console.error('generateLessonAction: failed to load teacher row:', teacherError)
    return { error: 'Could not load your account. Please try again.' }
  }

  const isPremium = hasActivePremium(teacher)
  if (
    !isPremium &&
    teacher.lessons_used_this_month >= FREE_TIER_MONTHLY_LIMIT
  ) {
    return { error: `You've used all ${FREE_TIER_MONTHLY_LIMIT} free lessons this month.` }
  }

  // 3. Fetch the REAL curriculum text — never trust anything the browser
  // sends about what the indicator says, only its id.
  const { data: indicator, error: indicatorError } = await supabase
    .from('curriculum_indicators')
    .select('*, subjects(name, class_level)')
    .eq('id', indicatorId)
    .single()

  if (indicatorError || !indicator) {
    console.error('generateLessonAction: failed to load indicator:', indicatorError)
    return { error: 'That curriculum indicator could not be found.' }
  }

  // 4. Call the AI, grounded in that real text.
  let lessonContent
  try {
    lessonContent = await generateLessonNote({
      subjectName: indicator.subjects.name,
      classLevel: indicator.subjects.class_level,
      strand: indicator.strand,
      subStrand: indicator.sub_strand,
      contentStandard: indicator.content_standard,
      indicatorText: indicator.indicator_text,
      indicatorCode: indicator.indicator_code,
    })
  } catch (err) {
    console.error('generateLessonAction: AI generation failed:', err)
    return { error: 'Something went wrong generating your lesson. Please try again.' }
  }

  // 5. Save it — combined with blank metadata fields (week ending, class
  // size, day, etc.) that the teacher fills in themselves in the editor,
  // exactly like writing them by hand in the paper lesson plan book.
  const { data: savedLesson, error: saveError } = await supabase
    .from('lesson_notes')
    .insert({
      teacher_id: user.id,
      indicator_id: indicatorId,
      content: { ...emptyLessonMetadata(), ...lessonContent },
    })
    .select('id')
    .single()

  if (saveError || !savedLesson) {
    return { error: 'Your lesson was generated but could not be saved. Please try again.' }
  }

  // 6. Count it against their monthly usage.
  await supabase
    .from('teachers')
    .update({ lessons_used_this_month: teacher.lessons_used_this_month + 1 })
    .eq('id', user.id)

  return { lessonId: savedLesson.id }
}

// ----------------------------------------------------------------------------
// Testing steps:
// 1. Log in as a free-tier teacher with lessons_used_this_month = 0.
// 2. Call generateLessonAction with a real indicator id from your seeded data.
// 3. Expected: a { lessonId: "..." } response, and a new row visible in
//    lesson_notes; teachers.lessons_used_this_month becomes 1.
// 4. Manually set lessons_used_this_month to 5, try again.
//    Expected: { error: "You've used all 5 free lessons this month." },
//    no new row created, no OpenAI call made (check your OpenAI usage
//    dashboard to confirm no request was billed).
//
// Common error: "row-level security policy violation" on the insert
// Fix: confirm the Phase 3 RLS policy "Teachers can create their own lesson
// notes" exists and that teacher_id matches auth.uid() exactly.
// ----------------------------------------------------------------------------
