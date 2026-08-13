// Purpose: Orchestrates Scheme of Learning generation.
// Folder: app/scheme/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { buildWeeklyGroups } from '@/lib/scheme/buildWeeklyGroups'
import { generateWeeklyFocusSummaries } from '@/lib/scheme/generateWeeklyFocusSummaries'

const FREE_TIER_MONTHLY_LIMIT = 5

export async function generateSchemeAction(
  subjectId: string,
  term: string,
  academicYear: string,
  numWeeks: number
) {
  // Same reasoning as the assessment action's clamp — the client's
  // <input max="16"> is a UI hint, not enforcement.
  const safeNumWeeks = Math.min(Math.max(Math.round(numWeeks), 1), 16)

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to generate a scheme.' }

  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at, schemes_used_this_month')
    .eq('id', user.id)
    .single()

  if (teacherError || !teacher) return { error: 'Could not load your account.' }

  const isPremium = hasActivePremium(teacher)
  if (
    !isPremium &&
    teacher.schemes_used_this_month >= FREE_TIER_MONTHLY_LIMIT
  ) {
    return { error: `You've used all ${FREE_TIER_MONTHLY_LIMIT} free schemes this month.` }
  }

  // Fetch ALL indicators for this subject — the real, seeded curriculum
  // data (Phase 5), not anything invented.
  const { data: indicators, error: indicatorsError } = await supabase
    .from('curriculum_indicators')
    .select('id, indicator_code, strand, sub_strand, indicator_text')
    .eq('subject_id', subjectId)

  if (indicatorsError || !indicators || indicators.length === 0) {
    return { error: 'No curriculum indicators found for this subject.' }
  }

  // Step 1: deterministic grouping (no AI).
  const weekGroups = buildWeeklyGroups(indicators, safeNumWeeks)

  // Step 2: AI adds readable focus summaries on top of that fixed structure.
  let weeksWithFocus
  try {
    weeksWithFocus = await generateWeeklyFocusSummaries(weekGroups)
  } catch {
    // Fall back gracefully: a scheme with correct indicators but no AI
    // summary text is still useful; failing the whole feature would not be.
    weeksWithFocus = weekGroups.map((w) => ({ ...w, focus_summary: '' }))
  }

  const { data: saved, error: saveError } = await supabase
    .from('schemes_of_learning')
    .insert({
      teacher_id: user.id,
      subject_id: subjectId,
      term,
      academic_year: academicYear,
      content: { weeks: weeksWithFocus },
    })
    .select('id')
    .single()

  if (saveError || !saved) return { error: 'Scheme generated but could not be saved.' }

  await supabase
    .from('teachers')
    .update({ schemes_used_this_month: teacher.schemes_used_this_month + 1 })
    .eq('id', user.id)

  return { schemeId: saved.id }
}

// Testing steps:
// 1. Generate a scheme for a subject with only 2 seeded indicators, 12 weeks.
//    Expected: only 2 weeks appear in the result (empty weeks are filtered
//    out by buildWeeklyGroups), each with a short AI-written focus summary.
// 2. Temporarily break OPENAI_API_KEY and try again.
//    Expected: scheme still saves successfully, just with empty
//    focus_summary text — confirming the graceful fallback works.
