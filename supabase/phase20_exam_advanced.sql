-- ============================================================================
-- TeacherAI Ghana — Phase 20: Exam Generator advanced features (Premium-only)
-- Run this AFTER phase19_security_fixes.sql
--
-- What this adds:
-- 1. Exams can now be built straight from curriculum indicators (a "standard
--    exam for the grade"), not only from a teacher's own already-generated
--    lessons — so `source_lesson_ids` must become optional, and we need a
--    parallel `source_indicator_ids` column plus a `source_type` flag to
--    know which path built a given exam.
-- 2. Teachers can now edit a generated exam's questions before exporting —
--    so exams need an UPDATE policy (previously insert+select only) and an
--    `updated_at` column so the editor can show "last saved" info.
-- ============================================================================

alter table exams
  add column source_type text not null default 'lessons'
    check (source_type in ('lessons', 'curriculum')),
  add column source_indicator_ids uuid[],
  add column updated_at timestamptz not null default now();

-- source_lesson_ids was NOT NULL under the old lessons-only design — a
-- curriculum-sourced exam has no source lessons at all, so this must relax.
alter table exams
  alter column source_lesson_ids drop not null;

comment on column exams.source_type is
  'Which generation path built this exam: "lessons" (from the teacher''s own generated lesson notes) or "curriculum" (a standard exam built directly from selected curriculum indicators for the grade, independent of whether lessons exist yet).';
comment on column exams.source_indicator_ids is
  'Which curriculum_indicators this exam was built from, when source_type = ''curriculum''. Null for lesson-sourced exams.';

-- Editing a generated exam (question text, options, marks, formatting)
-- before export is a new Premium feature — needs its own UPDATE policy,
-- same owner-only pattern as every other table. Premium gating itself
-- stays in app code (app/exam/actions.ts), not RLS, matching how the rest
-- of the Exam Generator's Premium gate already works.
create policy "Teachers can update their own exams"
  on exams for update
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Keep updated_at accurate automatically, same trigger style used
-- elsewhere in the schema for tracking edits.
create or replace function set_exams_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_exams_updated_at
  before update on exams
  for each row
  execute function set_exams_updated_at();

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Confirm exams.source_lesson_ids now accepts null, exams.source_type
--    defaults to 'lessons', exams.source_indicator_ids exists.
-- 3. As the owning teacher, UPDATE an exams row's content — should succeed
--    and updated_at should change automatically. As a different teacher,
--    the same UPDATE should affect 0 rows (RLS blocks it).
-- ============================================================================
