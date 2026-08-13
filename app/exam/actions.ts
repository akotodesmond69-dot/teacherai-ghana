// Purpose: Orchestrates exam generation — Premium-only, built from the
// teacher's own previously-generated lessons.
// Folder: app/exam/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { generateExam } from '@/lib/ai/generateExam'
import { getExamBand, EXAM_STRUCTURES } from '@/lib/ai/examSchema'
import type { LessonSourceInput } from '@/lib/ai/buildExamPrompt'

export async function generateExamAction(lessonIds: string[]) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to generate an exam.' }

  if (lessonIds.length === 0) {
    return { error: 'Select at least one lesson to build the exam from.' }
  }

  // WHY this is a hard gate, not a usage-limit like the other features:
  // the Exam Generator is Premium-only entirely — there's no free tier for
  // it at all, unlike lessons/assessments/schemes which give free teachers
  // a limited monthly allowance. A non-Premium teacher should never reach
  // this far, but we check here too, server-side, since the UI gate alone
  // is never sufficient (a client-side check is a suggestion, not security).
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', user.id)
    .single()

  if (teacherError || !teacher) {
    console.error('generateExamAction: failed to load teacher row:', teacherError)
    return { error: 'Could not load your account. Please try again.' }
  }

  if (!hasActivePremium(teacher)) {
    return { error: 'The Exam Generator is a Premium feature. Upgrade to unlock it.' }
  }

  // Fetch the real, owned lessons — RLS already guarantees these belong to
  // this teacher; a lesson id belonging to someone else simply won't
  // appear in the results, rather than causing an error or a leak.
  const { data: lessons, error: lessonsError } = await supabase
    .from('lesson_notes')
    .select(`
      id, content,
      curriculum_indicators (
        indicator_text, strand, sub_strand, subject_id,
        subjects (name, class_level)
      )
    `)
    .in('id', lessonIds)
    .eq('teacher_id', user.id)

  if (lessonsError || !lessons || lessons.length === 0) {
    console.error('generateExamAction: failed to load lessons:', lessonsError)
    return { error: 'Could not find the selected lessons.' }
  }

  // Enforce one subject + class per exam — mixing Math and Science into
  // one paper would not be a coherent exam.
  const firstIndicator = lessons[0].curriculum_indicators as any
  const subjectId = firstIndicator.subject_id
  const subjectName = firstIndicator.subjects.name
  const classLevel = firstIndicator.subjects.class_level
  const allSameSubject = lessons.every(
    (l) => (l.curriculum_indicators as any).subject_id === subjectId
  )
  if (!allSameSubject) {
    return { error: 'All selected lessons must be the same subject and class.' }
  }

  const structure = EXAM_STRUCTURES[getExamBand(classLevel)]

  const lessonSources: LessonSourceInput[] = lessons.map((l) => {
    const ind = l.curriculum_indicators as any
    return {
      indicatorText: ind.indicator_text,
      strand: ind.strand,
      subStrand: ind.sub_strand,
      content: l.content,
    }
  })

  let examContent
  try {
    examContent = await generateExam(subjectName, classLevel, lessonSources, structure)
  } catch (err) {
    console.error('generateExamAction: AI generation failed:', err)
    return { error: 'Something went wrong generating the exam. Please try again.' }
  }

  const { data: saved, error: saveError } = await supabase
    .from('exams')
    .insert({
      teacher_id: user.id,
      subject_id: subjectId,
      class_level: classLevel,
      source_lesson_ids: lessonIds,
      content: examContent,
    })
    .select('id')
    .single()

  if (saveError || !saved) {
    console.error('generateExamAction: failed to save exam:', saveError)
    return { error: 'Exam generated but could not be saved.' }
  }

  return { examId: saved.id }
}

// Testing steps:
// 1. As a non-Premium teacher, call this action. Expected: { error: "The
//    Exam Generator is a Premium feature..." } — no AI call is made
//    (confirm via your Gemini usage dashboard that no request was billed).
// 2. As a Premium teacher, select 2-3 lessons from the same Basic 4
//    subject, generate. Expected: an exam with exactly 30 objective + 8
//    theory questions (upper_primary structure), total_marks 100.
// 3. Try selecting lessons from two different subjects.
//    Expected: { error: "All selected lessons must be the same subject
//    and class." }
