-- ============================================================================
-- TeacherAI Ghana — Phase 21: In-app Word Processor (Advanced Formatting)
-- Run this AFTER phase20_exam_advanced.sql
--
-- What this adds:
-- 1. teachers.school_logo_url — a school badge/crest image, used by the new
--    exam Word Processor to automatically build a real Ghanaian-style exam
--    letterhead (school name + logo, centered, above the paper). Reuses the
--    existing "avatars" Storage bucket and its RLS (owner-only write, path
--    prefixed by the teacher's own user id) rather than creating a new
--    bucket — a logo is just another file a teacher owns, same trust model
--    as their avatar photo, so a second bucket would add nothing but
--    duplicate policies to maintain.
-- 2. exams.document_json / document_updated_at — stores the *free-form*
--    rich-text document (Tiptap's ProseMirror JSON) a teacher builds in the
--    new Word Processor, separate from exams.content (the structured
--    question data used for AI generation, the plain question editor, and
--    the original PDF/Word export). Kept as a separate column rather than
--    replacing `content`: the structured data must stay intact so a paper
--    can still be regenerated/re-validated by question count, while the
--    freeform document is purely presentational — a teacher's own
--    formatting, images, and letterhead layered on top.
-- ============================================================================

alter table teachers add column school_logo_url text;

alter table exams
  add column document_json jsonb,
  add column document_updated_at timestamptz;

comment on column teachers.school_logo_url is
  'Public URL of the school badge/crest image, stored in the existing "avatars" Storage bucket at {teacher_id}/school-logo.*. Used to auto-build the exam Word Processor letterhead.';
comment on column exams.document_json is
  'Free-form rich-text document (Tiptap/ProseMirror JSON) built in the in-app Word Processor — the teacher''s own formatting/images/letterhead layered on top of the structured exam in `content`. Null until a teacher opens the Word Processor for this exam at least once.';

-- No new RLS policies needed: exams already has an owner-only UPDATE
-- policy from Phase 20 (covers this new column, same row), and the
-- avatars bucket's existing policies already scope writes to
-- {auth.uid()}/* for any filename, including a school-logo file.

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration.
-- 2. Confirm teachers.school_logo_url exists (nullable), and
--    exams.document_json / document_updated_at exist (both nullable).
-- 3. As a teacher, upload a file to avatars/{your_user_id}/school-logo.png
--    via the Storage UI or the app — should succeed under the existing
--    Phase 17 policies, no new policy required.
-- ============================================================================
