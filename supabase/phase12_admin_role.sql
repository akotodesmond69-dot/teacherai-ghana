-- ============================================================================
-- TeacherAI Ghana — Phase 12: Admin role and dashboard access
-- Run this AFTER phase11_assistant_tables.sql
-- ============================================================================

alter table teachers add column is_admin boolean not null default false;

-- WHY a reusable SQL function instead of repeating this subquery in every
-- policy below: every admin-access policy needs the exact same check
-- ("is the current user an admin?"). Writing it once here means if we ever
-- change how admin status is determined, we update one place, not a dozen
-- policies.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from teachers where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- Curriculum tables: previously read-only for everyone (Phase 3), with no
-- write policy at all. Now admins can manage curriculum data through the
-- app itself, not just through the Phase 5 seed script.
-- ----------------------------------------------------------------------------
create policy "Admins can insert subjects"
  on subjects for insert
  with check (public.is_admin());

create policy "Admins can update subjects"
  on subjects for update
  using (public.is_admin());

create policy "Admins can insert curriculum indicators"
  on curriculum_indicators for insert
  with check (public.is_admin());

create policy "Admins can update curriculum indicators"
  on curriculum_indicators for update
  using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Teacher-generated content: admins get READ access for analytics only.
-- WHY no admin update/delete policy on these: a teacher's lesson notes,
-- assessments, and chat messages are their own work and words. Analytics
-- (counts, aggregates) don't require an admin to open individual content,
-- and giving broad edit/delete access here is a bigger privacy footprint
-- than this MVP needs. If a real moderation need arises later, that's a
-- deliberate, separate decision — not a default.
-- ----------------------------------------------------------------------------
create policy "Admins can view all lesson notes"
  on lesson_notes for select
  using (public.is_admin());

create policy "Admins can view all assessments"
  on assessments for select
  using (public.is_admin());

create policy "Admins can view all schemes"
  on schemes_of_learning for select
  using (public.is_admin());

create policy "Admins can view all teacher profiles"
  on teachers for select
  using (public.is_admin());

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Manually set is_admin = true for one test teacher row (via Supabase
--    Table Editor — no UI exists to grant this, on purpose).
-- 3. As that teacher, confirm you can now select * from teachers (all rows).
-- 4. As a non-admin teacher, confirm you still only see your own row —
--    the original Phase 3 policy ("view their own profile") still applies
--    alongside this new admin policy; Postgres RLS policies are additive
--    (a row is visible if ANY policy allows it).
-- ============================================================================
