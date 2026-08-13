// Purpose: Loads curriculum data from data/curriculum-seed-data.json into
// the subjects and curriculum_indicators tables (built in Phase 3).
// Folder: scripts/seed-curriculum.ts
// Depends on: @supabase/supabase-js, dotenv
// How it works: reads the JSON file, then for each subject, inserts (or
// finds an existing) subjects row, then inserts each of its indicators.
//
// Run it with:  npm run seed:curriculum
// Requires a .env.local file (never committed to git) with:
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...   <-- the powerful key, keep this secret

// WHY this needs an explicit path: dotenv, by default, only looks for a
// file named exactly ".env" — but our project (following Next.js
// convention) uses ".env.local" instead. Without telling dotenv exactly
// where to look, it silently finds nothing and moves on, which is why this
// bug doesn't throw an error about dotenv itself — it just leaves
// SUPABASE_URL undefined further down.
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service key: bypasses RLS on purpose,
                                          // only ever run from this script, by a developer,
                                          // never from the app or a browser.
)

async function main() {
  const filePath = path.join(__dirname, '../data/curriculum-seed-data.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { subjects } = JSON.parse(raw)

  for (const subject of subjects) {
    console.log(`Loading subject: ${subject.name} (${subject.class_level})`)

    // Insert the subject, or reuse it if it already exists (avoids duplicates
    // if you run this script more than once).
    const { data: existing } = await supabase
      .from('subjects')
      .select('id')
      .eq('name', subject.name)
      .eq('class_level', subject.class_level)
      .maybeSingle()

    let subjectId = existing?.id

    if (!subjectId) {
      const { data: inserted, error } = await supabase
        .from('subjects')
        .insert({ name: subject.name, class_level: subject.class_level })
        .select('id')
        .single()

      if (error) throw error
      subjectId = inserted.id
    }

    // Insert each indicator under this subject.
    for (const indicator of subject.indicators) {
      const { error } = await supabase
        .from('curriculum_indicators')
        .upsert(
          {
            subject_id: subjectId,
            strand: indicator.strand,
            sub_strand: indicator.sub_strand,
            content_standard: indicator.content_standard,
            indicator_text: indicator.indicator_text,
            indicator_code: indicator.indicator_code,
          },
          // WHY 'subject_id,indicator_code' and not just 'indicator_code':
          // Phase 15 corrected the database rule — a code only needs to be
          // unique within its own subject, since NaCCA restarts numbering
          // (e.g. B4.1.1.1.1) separately for Math, Science, English, etc.
          { onConflict: 'subject_id,indicator_code' } // re-running the script updates,
                                            // rather than duplicates, existing rows
        )

      if (error) throw error
      console.log(`  Loaded indicator ${indicator.indicator_code}`)
    }
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error('Seed script failed:', err.message)
  process.exit(1)
})

// ----------------------------------------------------------------------------
// Testing steps:
// 1. Create .env.local with your real SUPABASE_URL and
//    SUPABASE_SERVICE_ROLE_KEY (found in Supabase dashboard > Project Settings > API).
// 2. Run: npx tsx scripts/seed-curriculum.ts
// 3. Expected output: "Loading subject: Mathematics (Basic 4)" then
//    "Loaded indicator B4.2.3.1.1" etc, ending in "Done."
// 4. Check in Supabase dashboard > Table Editor > curriculum_indicators.
//    Expected: the rows are there.
//
// Common error: "Invalid API key"
// Fix: you're using the anon key by mistake — this script needs the
// service_role key specifically, since it writes to protected tables.
//
// Common error: "duplicate key value violates unique constraint"
// Fix: only happens if you change onConflict handling; the upsert above
// already prevents this for indicator_code, but subject_id lookups run
// per-row, so if two indicators seed with a race condition this can appear
// with heavy concurrency — not a concern at MVP's small seed-file scale.
// ----------------------------------------------------------------------------
