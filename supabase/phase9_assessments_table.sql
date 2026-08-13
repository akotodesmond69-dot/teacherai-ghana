-- ============================================================================
-- TeacherAI Ghana — Phase 9: Assessments table
-- Run this AFTER phase3_database.sql and phase4_auth_trigger.sql
-- ============================================================================

create table assessments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  indicator_id uuid not null references curriculum_indicators(id) on delete restrict,
  content jsonb not null,
  created_at timestamptz not null default now()
);

comment on table assessments is 'AI-generated assessments (questions + marking scheme) tied to a curriculum indicator.';

create index idx_assessments_teacher on assessments(teacher_id);
create index idx_assessments_indicator on assessments(indicator_id);

-- Same ownership rule as lesson_notes: a teacher only ever sees their own.
alter table assessments enable row level security;

create policy "Teachers can view their own assessments"
  on assessments for select
  using (auth.uid() = teacher_id);

create policy "Teachers can create their own assessments"
  on assessments for insert
  with check (auth.uid() = teacher_id);

-- WHY a separate usage counter, not reusing lessons_used_this_month:
-- lesson generation and assessment generation are different actions a
-- teacher might use at very different rates. Keeping separate counters now
-- means Phase 12's future billing/limits system can price or cap them
-- independently, rather than us having to untangle one shared number later.
alter table teachers add column assessments_used_this_month int not null default 0;

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Confirm in Supabase Table Editor: assessments table exists, and
--    teachers table now has an assessments_used_this_month column (default 0).
-- ============================================================================
