// Purpose: Lists community-submitted curriculum indicators awaiting admin
// review, with Verify and Delete actions.
// Folder: app/admin/curriculum/page.tsx

import { createClient } from '@/lib/supabase/server'
import { VerifyRow } from './verify-row'

export default async function AdminCurriculumPage() {
  const supabase = await createClient()

  const { data: pending } = await supabase
    .from('curriculum_indicators')
    .select('id, strand, sub_strand, indicator_text, indicator_code, subjects(name, class_level), teachers(school_name)')
    .eq('is_verified', false)
    .order('id', { ascending: false })

  return (
    <div>
      <h1 className="mb-2 text-2xl font-medium">Community curriculum submissions</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        These were submitted by teachers and are visible to everyone already
        (marked "Community"), but haven't been checked against the official
        NaCCA document yet.
      </p>

      {!pending || pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing pending review right now.</p>
      ) : (
        <div className="space-y-3">
          {pending.map((ind: any) => (
            <VerifyRow
              key={ind.id}
              id={ind.id}
              subjectLabel={`${ind.subjects.name} · ${ind.subjects.class_level}`}
              strand={ind.strand}
              subStrand={ind.sub_strand}
              indicatorText={ind.indicator_text}
              indicatorCode={ind.indicator_code}
              submittedBySchool={ind.teachers?.school_name ?? 'Unknown school'}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Testing steps:
// 1. Submit a curriculum indicator as a teacher (app/curriculum/new).
// 2. Visit /admin/curriculum as an admin. Expected: it appears in the list.
// 3. Click "Verify". Expected: it disappears from this list (no longer
//    pending), and on /generate its "Community — not yet verified" badge
//    is gone.
