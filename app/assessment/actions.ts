// Purpose: Orchestrates assessment generation — same flow as
// app/generate/actions.ts (Phase 6), but for assessments.
// Folder: app/assessment/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { generateAssessment } from '@/lib/ai/generateAssessment'
import type { QuestionType } from '@/lib/ai/assessmentSchema'

const FREE_TIER_MONTHLY_LIMIT = 5

export async function generateAssessmentAction(
  indicatorId: string,
  questionTypes: QuestionType[],
  numQuestions: number
) {
  // WHY this clamp exists: the client-side <input max="20"> on the
  // Generator form is a UI convenience, not a security boundary — anyone
  // could call this server action directly with numQuestions: 99999,
  // producing an enormous, expensive AI request. Server-side clamping is
  // the actual enforcement point.
  const safeNumQuestions = Math.min(Math.max(Math.round(numQuestions), 1), 20)

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to generate an assessment.' }

  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at, assessments_used_this_month')
    .eq('id', user.id)
    .single()

  if (teacherError || !teacher) return { error: 'Could not load your account.' }

  const isPremium = hasActivePremium(teacher)
  if (
    !isPremium &&
    teacher.assessments_used_this_month >= FREE_TIER_MONTHLY_LIMIT
  ) {
    return { error: `You've used all ${FREE_TIER_MONTHLY_LIMIT} free assessments this month.` }
  }

  const { data: indicator, error: indicatorError } = await supabase
    .from('curriculum_indicators')
    .select('*, subjects(name, class_level)')
    .eq('id', indicatorId)
    .single()

  if (indicatorError || !indicator) return { error: 'Curriculum indicator not found.' }

  let assessmentContent
  try {
    assessmentContent = await generateAssessment(
      {
        subjectName: indicator.subjects.name,
        classLevel: indicator.subjects.class_level,
        strand: indicator.strand,
        subStrand: indicator.sub_strand,
        contentStandard: indicator.content_standard,
        indicatorText: indicator.indicator_text,
        indicatorCode: indicator.indicator_code,
      },
      { questionTypes, numQuestions: safeNumQuestions }
    )
  } catch {
    return { error: 'Something went wrong generating the assessment. Please try again.' }
  }

  const { data: saved, error: saveError } = await supabase
    .from('assessments')
    .insert({ teacher_id: user.id, indicator_id: indicatorId, content: assessmentContent })
    .select('id')
    .single()

  if (saveError || !saved) return { error: 'Assessment generated but could not be saved.' }

  await supabase
    .from('teachers')
    .update({ assessments_used_this_month: teacher.assessments_used_this_month + 1 })
    .eq('id', user.id)

  return { assessmentId: saved.id }
}
