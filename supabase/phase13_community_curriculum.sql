-- ============================================================================
-- TeacherAI Ghana — Phase 13: Teacher-submitted curriculum indicators
-- Run this AFTER phase12_admin_role.sql
-- ============================================================================

-- WHY these two columns: we need to know (a) who submitted an indicator, so
-- we can trace it back and so a teacher can see "my submissions," and
-- (b) whether it's been verified against the real NaCCA document — this is
-- what keeps community submissions visually and functionally distinct from
-- the official, verified curriculum data seeded in Phase 5.
alter table curriculum_indicators
  add column created_by uuid references teachers(id) on delete set null,
  add column is_verified boolean not null default true;

-- WHY default true: existing rows (our verified Phase 5 seed data) should
-- stay marked verified without us having to backfill them manually. New
-- teacher-submitted rows explicitly set is_verified = false in the insert
-- itself (see app/curriculum/actions.ts) — the default only covers rows
-- that don't specify it.

comment on column curriculum_indicators.is_verified is
  'true = official, verified NaCCA curriculum data. false = submitted by a teacher, not yet reviewed by an admin.';

-- ----------------------------------------------------------------------------
-- Allow any authenticated teacher to submit new indicators AND new subjects
-- (in case their subject/class combination doesn't exist yet either).
-- Previously (Phase 12), only admins could insert here.
-- ----------------------------------------------------------------------------
create policy "Teachers can submit new subjects"
  on subjects for insert
  to authenticated
  with check (true);

create policy "Teachers can submit new curriculum indicators"
  on curriculum_indicators for insert
  to authenticated
  with check (created_by = auth.uid());

-- ----------------------------------------------------------------------------
-- Admins can verify (or correct) community submissions. Combined with the
-- Phase 12 "Admins can update curriculum indicators" policy, this is
-- already covered — no new policy needed here, just noting it.
-- ----------------------------------------------------------------------------

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. As a non-admin teacher, insert a curriculum_indicators row with
--    created_by = your own id, is_verified = false.
--    Expected: succeeds (previously this would have been blocked).
-- 3. Try inserting with created_by set to a DIFFERENT teacher's id.
--    Expected: blocked by the "with check (created_by = auth.uid())" clause
--    — you can only ever submit as yourself.
-- 4. Confirm existing seeded rows still show is_verified = true:
--    select indicator_code, is_verified from curriculum_indicators
--    where created_by is null;
-- ============================================================================
