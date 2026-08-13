// Purpose: Orchestrates exercise generation from uploaded content —
// Premium-only, same hard server-side gate pattern as the Exam Generator.
// Folder: app/exercises/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { generateExerciseFromText, generateExerciseFromImage } from '@/lib/ai/generateExercise'

// WHY an explicit named type here: without it, TypeScript infers the
// return type from every individual `return` statement in each function,
// which produces a large, awkward structural union that doesn't narrow
// cleanly on the client with a simple `if ('error' in result)` check.
// Naming the shape once forces every branch to conform to it.
type ExerciseActionResult = { error: string } | { exerciseId: string }

async function checkPremium(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ error: string } | { userId: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in.' }

  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', user.id)
    .single()

  if (error || !teacher) {
    console.error('checkPremium: failed to load teacher:', error)
    return { error: 'Could not load your account.' }
  }
  if (!hasActivePremium(teacher)) {
    return { error: 'The Exercise Generator is a Premium feature. Upgrade to unlock it.' }
  }
  return { userId: user.id }
}

export async function generateExerciseFromTextAction(
  extractedText: string,
  questionCount: number,
  sourceSummary: string
): Promise<ExerciseActionResult> {
  const safeQuestionCount = Math.min(Math.max(Math.round(questionCount), 1), 30)

  const supabase = await createClient()
  const gate = await checkPremium(supabase)
  if ('error' in gate) return gate

  if (!extractedText || extractedText.trim().length < 20) {
    return { error: 'Could not find enough readable text in that file.' }
  }

  let content
  try {
    content = await generateExerciseFromText(extractedText, safeQuestionCount)
  } catch (err) {
    console.error('generateExerciseFromTextAction: AI failed:', err)
    return { error: 'Something went wrong generating the exercise. Please try again.' }
  }

  const { data: saved, error: saveError } = await supabase
    .from('exercises')
    .insert({ teacher_id: gate.userId, source_type: 'text', source_summary: sourceSummary, content })
    .select('id')
    .single()

  if (saveError || !saved) {
    console.error('generateExerciseFromTextAction: save failed:', saveError)
    return { error: 'Exercise generated but could not be saved.' }
  }
  return { exerciseId: saved.id }
}

export async function generateExerciseFromImageAction(
  imageDataUrl: string,
  questionCount: number,
  sourceSummary: string
): Promise<ExerciseActionResult> {
  const safeQuestionCount = Math.min(Math.max(Math.round(questionCount), 1), 30)

  // WHY this size guard: a base64 data URL is roughly 4/3 the size of the
  // original file. Capping around 7MB of base64 (~5MB original image)
  // prevents an oversized photo from producing a very expensive, possibly
  // rejected AI request — and gives the teacher a clear reason instead of
  // a confusing downstream failure.
  if (imageDataUrl.length > 7_000_000) {
    return { error: 'That photo is too large. Please use a smaller image (under ~5MB).' }
  }

  const supabase = await createClient()
  const gate = await checkPremium(supabase)
  if ('error' in gate) return gate

  let content
  try {
    content = await generateExerciseFromImage(imageDataUrl, safeQuestionCount)
  } catch (err) {
    console.error('generateExerciseFromImageAction: AI failed:', err)
    return { error: 'Something went wrong generating the exercise. Please try again.' }
  }

  const { data: saved, error: saveError } = await supabase
    .from('exercises')
    .insert({ teacher_id: gate.userId, source_type: 'image', source_summary: sourceSummary, content })
    .select('id')
    .single()

  if (saveError || !saved) {
    console.error('generateExerciseFromImageAction: save failed:', saveError)
    return { error: 'Exercise generated but could not be saved.' }
  }
  return { exerciseId: saved.id }
}

// Testing steps:
// 1. As non-Premium, call either action. Expected: Premium-required error,
//    no AI call made (confirm via Gemini usage dashboard).
// 2. As Premium, upload a real PDF page of text, generate 10 questions.
//    Expected: real questions grounded in that actual text, not generic.
// 3. As Premium, upload a photo of a book page, generate 5 questions.
//    Expected: works via Gemini vision, questions match what's in the photo.
