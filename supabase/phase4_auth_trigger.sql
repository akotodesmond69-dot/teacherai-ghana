-- ============================================================================
-- Purpose: Automatically create a `teachers` profile row whenever a new
-- user signs up via Supabase Auth (email or Google).
-- Folder: supabase/ (run as a migration, applied AFTER phase3 schema)
-- Depends on: the `teachers` table from Phase 3
-- How it works: Postgres triggers let you attach a function to run
-- automatically whenever a row is inserted/updated/deleted on a table.
-- Here, every time Supabase Auth inserts a row into auth.users (which
-- happens the instant someone signs up), this trigger fires and inserts
-- a matching row into our `teachers` table.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer -- runs with the permissions of the function owner, not the
                 -- calling user, so it can write to `teachers` even though
                 -- the new user has no RLS grant to insert rows yet.
set search_path = public
as $$
begin
  insert into public.teachers (id, school_name, subscription_tier)
  values (
    new.id,
    new.raw_user_meta_data ->> 'school_name', -- passed in at sign-up, see login page below
    'free'
  );
  return new;
end;
$$;

-- Attach the function to auth.users so it runs after every new sign-up.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================================
-- Testing steps:
-- 1. Apply this migration in the Supabase SQL editor.
-- 2. Sign up a test user through your app (or Supabase dashboard > Auth > Add user).
-- 3. Run: select * from teachers where id = '<new user id>';
--    Expected: one row exists automatically, subscription_tier = 'free'.
--
-- Common error: "permission denied for table teachers"
-- Fix: confirm `security definer` is present on the function — without it,
-- the trigger runs as the anonymous/authenticated role, which RLS blocks.
-- ============================================================================
