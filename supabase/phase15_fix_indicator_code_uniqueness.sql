-- ============================================================================
-- TeacherAI Ghana — Phase 15: Fix indicator_code uniqueness
-- Run this AFTER phase14_payments.sql
--
-- WHY this fix is needed: Phase 3 made indicator_code globally unique
-- across the whole curriculum_indicators table. But NaCCA's own numbering
-- restarts at B4.1.1.1.1 for EVERY subject — Mathematics, Science, and
-- English each have their own B4.1.1.1.1. The correct rule is: a code only
-- needs to be unique WITHIN a subject, not across all subjects. This
-- migration corrects that.
-- ============================================================================

-- Remove the old, too-strict global uniqueness rule.
-- (Postgres auto-names this constraint; this is its default name pattern.)
alter table curriculum_indicators
  drop constraint if exists curriculum_indicators_indicator_code_key;

-- Add the correct rule: unique per subject, not globally.
alter table curriculum_indicators
  add constraint curriculum_indicators_subject_code_unique
  unique (subject_id, indicator_code);

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Try inserting two rows with the same indicator_code but different
--    subject_id values. Expected: both succeed.
-- 3. Try inserting two rows with the same indicator_code AND the same
--    subject_id. Expected: rejected — this is still correctly prevented.
-- ============================================================================
