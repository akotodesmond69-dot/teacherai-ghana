# TeacherAI Ghana — Project Reference

Built across 12 phases, mentor-style, from Phase 1 (Planning) through Phase 12
(Admin Dashboard). This file is your map back through everything.

## What this app does

A Ghanaian teacher signs up, picks a NaCCA curriculum indicator, and gets an
AI-generated lesson note, assessment, or scheme of learning — grounded in
real curriculum data, not AI guesswork. A general-purpose teaching assistant
chat helps with everyday classroom questions. Admins see platform-wide usage.

## Setup, from zero

1. `npm install`
2. **Supabase project:** create one at supabase.com. Run the SQL files in
   `supabase/` **in order** (phase3 → phase4 → phase9 → phase10 → phase11 →
   phase12 — phase5's curriculum data is a script, not SQL, see below).
3. **Environment variables:** copy `.env.local.example` to `.env.local` and
   fill in real values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_URL=...                    # for the seed script only
   SUPABASE_SERVICE_ROLE_KEY=...       # for the seed script only — keep secret
   OPENAI_API_KEY=...
   ```
4. **Google OAuth:** configure in Google Cloud Console + Supabase Dashboard →
   Authentication → Providers (see Phase 4 notes).
5. **Seed curriculum data:** `npm run seed:curriculum`
6. **Make yourself an admin:** in Supabase Table Editor, set your own
   `teachers.is_admin` to `true`.
7. `npm run dev` and visit `localhost:3000`

## Deploying to Vercel

1. Push this project to a GitHub repository (`.gitignore` already excludes
   `node_modules` and `.env.local`).
2. Import the repo at vercel.com — Next.js is auto-detected.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `OPENAI_API_KEY` in Vercel's Environment Variables (not the service role
   key — that's local-only, used by the seed script).
4. In Supabase → Authentication → URL Configuration, add your Vercel domain
   to both Site URL and Redirect URLs.
5. Deploy, then repeat the Phase 6 end-to-end test on the live URL: sign up,
   generate a lesson, confirm it appears on the dashboard, edit and save it.

## Phase-by-phase map

| Phase | What it built | Key files |
|---|---|---|
| 1. Planning | MVP scope, roadmap | `teacherai-ghana-phase1-planning.md` |
| 2. Design | Colors, type, components | `teacherai-ghana-phase2-design-system.md` |
| 3. Database | Core schema + RLS | `supabase/phase3_database.sql` |
| 4. Auth | Login, signup, Google, reset | `app/login`, `app/signup`, `middleware.ts`, `lib/supabase/` |
| 5. Curriculum data | Seed script | `data/curriculum-seed-data.json`, `scripts/seed-curriculum.ts` |
| 6. Lesson generator | AI grounding technique | `lib/ai/generateLessonNote.ts`, `app/generate/` |
| 7. Prompt engineering | System/user split, retries | `lib/ai/buildPrompt.ts` |
| 8. Lesson editor | Dashboard + editor, real data | `app/dashboard/`, `app/lesson/[id]/` |
| 9. Assessments | Second grounded AI feature | `lib/ai/generateAssessment.ts`, `app/assessment/` |
| 10. Schemes of learning | Deterministic + AI hybrid | `lib/scheme/`, `app/scheme/` |
| 11. Teacher assistant | Open-ended chat, different grounding rules | `lib/assistant/`, `app/assistant/` |
| 12. Admin dashboard | Roles, analytics | `supabase/phase12_admin_role.sql`, `app/admin/` |

## The one idea that repeats everywhere

Every AI feature in this app follows the same shape:
**define the output shape → build a prompt grounded in real data → call the
AI → validate before trusting it → save.** Once you understand this pattern
in Phase 6, every later AI feature (9, 10, 11) is a variation on it, not a
new thing to learn.

## Deliberately deferred — not forgotten, sequenced

These were named explicitly at each phase as intentional MVP trade-offs:

- **Rich text editing, autosave, version history, PDF/Word export** (Phase 8) —
  the editor works, but plainly; these are the natural next upgrade.
- **Full automated NaCCA importer with versioning** (Phase 5) — we built a
  manual seed script with real structure; the automated importer reads a
  PDF/source instead of a hand-written JSON file, same downstream shape.
- **RAG / semantic curriculum search** (Phase 7) — only becomes necessary
  once the curriculum dataset is large enough that a dropdown stops working.
- **Payments/billing** (Phase 12) — usage limits exist and are enforced;
  actually charging a card is unbuilt.
- **User management actions in Admin** (Phase 12) — read-only by design for now.

## What's genuinely left before real teachers use this

1. **Deploy** — push this repo to GitHub, connect to Vercel, add the same
   environment variables in Vercel's dashboard, point your Supabase project's
   URL allow-list at your real domain.
2. **Replace the placeholder curriculum seed data** with verified text from
   the official NaCCA PDFs (flagged honestly back in Phase 5).
3. **Real user testing** with a handful of actual teachers before wider launch.

## The habit to carry forward

Every phase in this build followed the same discipline: explain WHY before
WHAT, build one small piece at a time, secure it before moving on, flag
trade-offs honestly instead of hiding them. That discipline — more than any
individual file — is what will let you maintain and extend this yourself.
