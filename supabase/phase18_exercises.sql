-- ============================================================================
-- TeacherAI Ghana — Phase 18: Exercise/Homework Generator (Premium-only)
-- Run this AFTER phase17_profile.sql
-- ============================================================================

create table exercises (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  source_type text not null check (source_type in ('text', 'image')),
  source_summary text not null, -- short label of what it was built from, e.g. filename
  content jsonb not null,
  created_at timestamptz not null default now()
);

comment on table exercises is 'AI-generated exercises/homework built from a teacher-uploaded PDF, Word doc, or photo. Premium-only, gated in app code.';

create index idx_exercises_teacher on exercises(teacher_id);

alter table exercises enable row level security;

create policy "Teachers can view their own exercises"
  on exercises for select
  using (auth.uid() = teacher_id);

create policy "Teachers can create their own exercises"
  on exercises for insert
  with check (auth.uid() = teacher_id);

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Confirm the exercises table exists, RLS enabled, owner-only.
-- ============================================================================
