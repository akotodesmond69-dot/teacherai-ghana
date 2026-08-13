-- ============================================================================
-- TeacherAI Ghana — Phase 3: MVP Database Schema
-- Run this as a Supabase migration (or paste into the SQL editor).
-- ============================================================================

-- Enable UUID generation (Supabase usually has this on already, safe to re-run)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. teachers
-- Extends Supabase's built-in auth.users table with app-specific profile data.
-- We do NOT store email/password here — Supabase Auth already owns that.
-- ----------------------------------------------------------------------------
create table teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  school_name text,
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'paid')),
  lessons_used_this_month int not null default 0,
  created_at timestamptz not null default now()
);

comment on table teachers is 'App-specific profile data for each teacher, extending auth.users.';

-- ----------------------------------------------------------------------------
-- 2. subjects
-- Simple lookup table: e.g. "Mathematics, Basic 4".
-- ----------------------------------------------------------------------------
create table subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_level text not null
);

comment on table subjects is 'Lookup table for subject + class level combinations (e.g. Mathematics, Basic 4).';

-- ----------------------------------------------------------------------------
-- 3. curriculum_indicators
-- The atomic NaCCA curriculum unit. Manually seeded for MVP;
-- Phase 5's importer will populate this automatically in the future.
-- ----------------------------------------------------------------------------
create table curriculum_indicators (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects(id) on delete cascade,
  strand text not null,
  sub_strand text not null,
  content_standard text,
  indicator_text text not null,
  indicator_code text not null unique
);

comment on table curriculum_indicators is 'Individual NaCCA learning indicators. Manually seeded for MVP.';

-- Index because indicator_code is searched/looked up frequently.
create index idx_curriculum_indicators_code on curriculum_indicators(indicator_code);
create index idx_curriculum_indicators_subject on curriculum_indicators(subject_id);

-- ----------------------------------------------------------------------------
-- 4. lesson_notes
-- AI-generated (and teacher-edited) lesson content.
-- content is jsonb: a structured document with sections like
-- objectives, starter_activity, teacher_activities, assessment, etc.
-- ----------------------------------------------------------------------------
create table lesson_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  indicator_id uuid not null references curriculum_indicators(id) on delete restrict,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table lesson_notes is 'AI-generated and teacher-edited lesson notes, linked to teacher and indicator.';

-- Indexed because every dashboard load queries "my lessons".
create index idx_lesson_notes_teacher on lesson_notes(teacher_id);
create index idx_lesson_notes_indicator on lesson_notes(indicator_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Turn RLS on for every table. Until we add policies below,
-- this means "no access at all" — a safe default to start from.
alter table teachers enable row level security;
alter table subjects enable row level security;
alter table curriculum_indicators enable row level security;
alter table lesson_notes enable row level security;

-- ---- teachers: a teacher can only read/update their own profile row ----
create policy "Teachers can view their own profile"
  on teachers for select
  using (auth.uid() = id);

create policy "Teachers can update their own profile"
  on teachers for update
  using (auth.uid() = id);

-- ---- subjects & curriculum_indicators: public reference data ----
-- Every authenticated teacher can read these; nobody can write from the
-- client (only an admin process, added in Phase 12, will manage these).
create policy "Any authenticated user can read subjects"
  on subjects for select
  to authenticated
  using (true);

create policy "Any authenticated user can read curriculum indicators"
  on curriculum_indicators for select
  to authenticated
  using (true);

-- ---- lesson_notes: strictly owner-only ----
create policy "Teachers can view their own lesson notes"
  on lesson_notes for select
  using (auth.uid() = teacher_id);

create policy "Teachers can create their own lesson notes"
  on lesson_notes for insert
  with check (auth.uid() = teacher_id);

create policy "Teachers can update their own lesson notes"
  on lesson_notes for update
  using (auth.uid() = teacher_id);

create policy "Teachers can delete their own lesson notes"
  on lesson_notes for delete
  using (auth.uid() = teacher_id);

-- ============================================================================
-- Testing this migration (manual steps, once applied in Supabase):
-- 1. Create two test users via Supabase Auth.
-- 2. Insert a teachers row for each (id = their auth.users id).
-- 3. As user A, try to select lesson_notes where teacher_id = user B's id.
--    Expected: zero rows returned, even though the row exists — RLS is working.
-- 4. As user A, insert a lesson_notes row with teacher_id = user B's id.
--    Expected: insert rejected by the "with check" policy.
-- ============================================================================
