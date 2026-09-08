// Purpose: Orchestrates exam generation and editing — all Premium-only.
// Two generation paths are supported:
// 1. generateExamAction — built from the teacher's own previously-generated
//    lessons (original Phase 16 behaviour).
// 2. generateExamFromCurriculumAction — a standard exam built directly from
//    selected curriculum indicators for a grade, no lessons required.
// Plus saveExamAction, so a teacher can edit question text/options/marks
// before exporting to PDF or Word.
// Folder: app/exam/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { generateExam, generateExamFromCurriculum } from '@/lib/ai/generateExam'
import { getExamBand, EXAM_STRUCTURES, isValidExamContent, type ExamContent } from '@/lib/ai/examSchema'
import type { LessonSourceInput, CurriculumSourceInput } from '@/lib/ai/buildExamPrompt'

// WHY this check is duplicated at the top of every exam action, not just
// the entry page: the Exam Generator (and all its features — curriculum
// generation, editing, export) is Premium-only entirely, with no free
// tier at all. A client-side check is a suggestion, never security — every
// server action that touches exam generation or editing re-checks here.
async function requirePremiumTeacher(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', userId)
    .single()

  if (error || !teacher) {
    console.error('requirePremiumTeacher: failed to load teacher row:', error)
    return { ok: false as const, error: 'Could not load your account. Please try again.' }
  }
  if (!hasActivePremium(teacher)) {
    return { ok: false as const, error: 'This is a Premium feature. Upgrade to unlock it.' }
  }
  return { ok: true as const }
}

export async function generateExamAction(lessonIds: string[]) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to generate an exam.' }

  if (lessonIds.length === 0) {
    return { error: 'Select at least one lesson to build the exam from.' }
  }

  const premiumCheck = await requirePremiumTeacher(supabase, user.id)
  if (!premiumCheck.ok) return { error: premiumCheck.error }

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
      source_type: 'lessons',
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

// WHY this needs its own action rather than reusing generateExamAction with
// a flag: the input shape is genuinely different (curriculum indicator ids,
// not lesson ids), the source data comes from a different table
// (curriculum_indicators directly, not lesson_notes), and it must NOT
// require the teacher to have generated any lessons at all — that's the
// whole point of this feature.
export async function generateExamFromCurriculumAction(indicatorIds: string[]) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to generate an exam.' }

  if (indicatorIds.length === 0) {
    return { error: 'Select at least one curriculum indicator to build the exam from.' }
  }

  const premiumCheck = await requirePremiumTeacher(supabase, user.id)
  if (!premiumCheck.ok) return { error: premiumCheck.error }

  // Fetch the REAL curriculum text — never trust anything the browser
  // sends about what an indicator says, only its id (same principle as
  // the Lesson Generator's generateLessonAction).
  const { data: indicators, error: indicatorsError } = await supabase
    .from('curriculum_indicators')
    .select('id, indicator_text, indicator_code, strand, sub_strand, content_standard, subject_id, subjects (name, class_level)')
    .in('id', indicatorIds)

  if (indicatorsError || !indicators || indicators.length === 0) {
    console.error('generateExamFromCurriculumAction: failed to load indicators:', indicatorsError)
    return { error: 'Could not find the selected curriculum indicators.' }
  }

  const firstSubject = indicators[0].subjects as any
  const subjectId = indicators[0].subject_id
  const subjectName = firstSubject.name
  const classLevel = firstSubject.class_level
  const allSameSubject = indicators.every((ind) => ind.subject_id === subjectId)
  if (!allSameSubject) {
    return { error: 'All selected indicators must be the same subject and class.' }
  }

  const structure = EXAM_STRUCTURES[getExamBand(classLevel)]

  const curriculumSources: CurriculumSourceInput[] = indicators.map((ind) => ({
    indicatorText: ind.indicator_text,
    strand: ind.strand,
    subStrand: ind.sub_strand,
    contentStandard: ind.content_standard,
    indicatorCode: ind.indicator_code,
  }))

  let examContent
  try {
    examContent = await generateExamFromCurriculum(subjectName, classLevel, curriculumSources, structure)
  } catch (err) {
    console.error('generateExamFromCurriculumAction: AI generation failed:', err)
    return { error: 'Something went wrong generating the exam. Please try again.' }
  }

  const { data: saved, error: saveError } = await supabase
    .from('exams')
    .insert({
      teacher_id: user.id,
      subject_id: subjectId,
      class_level: classLevel,
      source_type: 'curriculum',
      source_indicator_ids: indicatorIds,
      content: examContent,
    })
    .select('id')
    .single()

  if (saveError || !saved) {
    console.error('generateExamFromCurriculumAction: failed to save exam:', saveError)
    return { error: 'Exam generated but could not be saved.' }
  }

  return { examId: saved.id }
}

// Lets a teacher edit question text, options, correct answers, marks, and
// exam-level fields (title/instructions/duration) before exporting, and
// persist those edits — same Premium gate, plus an explicit ownership
// check on top of RLS (belt and suspenders: RLS alone would just make the
// update affect 0 rows silently, which we want to surface as a real error
// rather than a silent no-op).
export async function saveExamAction(examId: string, content: ExamContent) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be logged in to save changes.' }

  const premiumCheck = await requirePremiumTeacher(supabase, user.id)
  if (!premiumCheck.ok) return { error: premiumCheck.error }

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, teacher_id, class_level')
    .eq('id', examId)
    .single()

  if (examError || !exam) return { error: 'Exam not found.' }
  if (exam.teacher_id !== user.id) return { error: 'You do not have permission to edit this exam.' }

  // Re-validate structure on save too — a teacher can edit question text
  // freely, but shouldn't be able to (accidentally, via a buggy client
  // state) save a paper with the wrong number of questions for the grade.
  const structure = EXAM_STRUCTURES[getExamBand(exam.class_level)]
  if (!isValidExamContent(content, structure)) {
    return { error: 'The exam is missing questions or does not match the required structure for this grade — please check before saving.' }
  }

  const { error: updateError } = await supabase
    .from('exams')
    .update({ content })
    .eq('id', examId)
    .eq('teacher_id', user.id)

  if (updateError) {
    console.error('saveExamAction: failed to save exam:', updateError)
    return { error: 'Could not save your changes. Please try again.' }
  }

  return { success: true as const }
}

// Testing steps:
// 1. As a non-Premium teacher, call any of the three actions above.
//    Expected: { error: 'This is a Premium feature...' } — no AI call made,
//    no write happens.
// 2. As a Premium teacher with zero lessons but a real curriculum indicator
//    id, call generateExamFromCurriculumAction. Expected: an exam is
//    generated and saved with source_type = 'curriculum', no lessons
//    required.
// 3. Open a saved exam, edit a question's text via saveExamAction with a
//    structurally valid ExamContent. Expected: { success: true }, and the
//    exams.content + updated_at columns reflect the edit.
// 4. Call saveExamAction with a question removed (wrong count for the
//    grade). Expected: a structure-mismatch error, no partial save.
