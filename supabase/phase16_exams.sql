-- ============================================================================
-- TeacherAI Ghana — Phase 16: Exam Generator (Premium-only)
-- Run this AFTER phase15_fix_indicator_code_uniqueness.sql
-- ============================================================================

create table exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  class_level text not null,
  source_lesson_ids uuid[] not null, -- which of the teacher's own lessons this was built from
  content jsonb not null,
  created_at timestamptz not null default now()
);

comment on table exams is 'AI-generated full exam papers, synthesized from a teacher''s own previously-generated lessons. Premium-only feature — gated in app code, not RLS, since this is about feature access, not data ownership.';

create index idx_exams_teacher on exams(teacher_id);

alter table exams enable row level security;

create policy "Teachers can view their own exams"
  on exams for select
  using (auth.uid() = teacher_id);

create policy "Teachers can create their own exams"
  on exams for insert
  with check (auth.uid() = teacher_id);

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Confirm the exams table exists with RLS enabled, owner-only policies.
-- ============================================================================
