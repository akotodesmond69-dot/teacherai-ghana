-- ============================================================================
-- TeacherAI Ghana — Phase 17: Teacher Profile (name, avatar, timetable)
-- Run this AFTER phase16_exams.sql
-- ============================================================================

alter table teachers add column full_name text;
alter table teachers add column avatar_url text;

-- ----------------------------------------------------------------------------
-- timetable_entries: a simple weekly grid. WHY free-text subject_label
-- rather than a foreign key to subjects: a real teacher's timetable
-- includes things that aren't curriculum subjects at all — break, assembly,
-- games, registration — so this needs to accept anything a teacher types,
-- not just our seeded subject list.
-- ----------------------------------------------------------------------------
create table timetable_entries (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Monday','Tuesday','Wednesday','Thursday','Friday')),
  period_label text not null,   -- e.g. "8:00 - 8:40" or "Period 1"
  subject_label text not null,  -- free text — a real subject, or "Break", "Assembly", etc.
  class_label text,             -- optional, e.g. "Basic 4"
  created_at timestamptz not null default now()
);

comment on table timetable_entries is 'A teacher''s own weekly timetable — free-text, not tied to curriculum subjects.';

create index idx_timetable_teacher on timetable_entries(teacher_id);

alter table timetable_entries enable row level security;

create policy "Teachers can view their own timetable"
  on timetable_entries for select
  using (auth.uid() = teacher_id);

create policy "Teachers can manage their own timetable"
  on timetable_entries for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- ----------------------------------------------------------------------------
-- Avatar storage: a Supabase Storage bucket for profile photos.
-- WHY a bucket instead of storing images directly in the database: Postgres
-- isn't designed to store binary files efficiently — Supabase Storage is a
-- proper object store (like S3) built for exactly this, and it's included
-- free with your Supabase project.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Anyone can VIEW avatars (they're profile photos, meant to be seen) —
-- but a teacher can only upload/replace/delete their OWN avatar file.
-- WHY we check the file path starts with the teacher's own user id: we'll
-- upload files named like "{user_id}/avatar.jpg" — this policy enforces
-- that a teacher can never overwrite someone else's file, since Storage
-- itself has no separate teacher_id column to check against.
create policy "Avatar images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Teachers can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Teachers can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Confirm teachers has full_name and avatar_url columns.
-- 3. Confirm a Storage bucket named "avatars" exists (Supabase dashboard >
--    Storage), and is marked Public.
-- 4. Confirm timetable_entries exists with RLS, owner-only for all operations.
-- ============================================================================
