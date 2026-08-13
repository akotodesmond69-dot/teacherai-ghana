-- ============================================================================
-- TeacherAI Ghana — Phase 10: Schemes of Learning table
-- Run this AFTER phase9_assessments_table.sql
-- ============================================================================

create table schemes_of_learning (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete restrict,
  term text not null,              -- e.g. 'Term 1', 'Term 2', 'Term 3'
  academic_year text not null,     -- e.g. '2025/2026'
  content jsonb not null,          -- { weeks: [ { week_number, indicator_ids,
                                    --   focus_summary } ] } — see buildWeeklyGroups.ts
  created_at timestamptz not null default now()
);

comment on table schemes_of_learning is 'A term''s worth of curriculum indicators organized week-by-week for a subject/class.';

create index idx_schemes_teacher on schemes_of_learning(teacher_id);
create index idx_schemes_subject on schemes_of_learning(subject_id);

alter table schemes_of_learning enable row level security;

create policy "Teachers can view their own schemes"
  on schemes_of_learning for select
  using (auth.uid() = teacher_id);

create policy "Teachers can create their own schemes"
  on schemes_of_learning for insert
  with check (auth.uid() = teacher_id);

-- Same reasoning as Phase 9: a separate counter per AI-generation feature.
alter table teachers add column schemes_used_this_month int not null default 0;

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Confirm schemes_of_learning exists and teachers has the new column.
-- ============================================================================
