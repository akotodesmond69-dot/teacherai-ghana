-- ============================================================================
-- TeacherAI Ghana — Phase 19: Security audit fixes
-- Run this AFTER phase18_exercises.sql
-- ============================================================================

-- WHY this fix: Phase 17's "Teachers can update their own avatar" policy
-- only had a USING clause, which controls which existing rows can be
-- targeted for update, but no WITH CHECK clause, which controls what the
-- row is allowed to become after the update. Without it, there's a
-- theoretical gap where an update could move a file's path outside the
-- teacher's own folder. Adding WITH CHECK closes that gap by enforcing the
-- same ownership rule on the result of the update, not just its target.
drop policy if exists "Teachers can update their own avatar" on storage.objects;

create policy "Teachers can update their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. As a teacher, upload/replace your own avatar. Expected: still works
--    normally — this fix doesn't change legitimate behavior.
-- ============================================================================
