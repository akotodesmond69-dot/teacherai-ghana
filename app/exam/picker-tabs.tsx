// Purpose: Tabs between the two exam-building paths — from the teacher's
// own already-generated lessons (original behaviour), or a standard exam
// built straight from the curriculum list (new). Keeping both as tabs
// rather than replacing one with the other, since a teacher who already
// has lessons for every topic may still prefer building from those exact
// lessons' wording.
// Folder: app/exam/picker-tabs.tsx
'use client'

import { useState } from 'react'
import { ExamPicker, type LessonRow } from './picker'
import { CurriculumExamPicker, type IndicatorOption } from './curriculum-picker'

export function ExamPickerTabs({
  lessons,
  indicators,
}: {
  lessons: LessonRow[]
  indicators: IndicatorOption[]
}) {
  const [tab, setTab] = useState<'curriculum' | 'lessons'>('curriculum')

  return (
    <div>
      <div className="mb-6 flex rounded-lg border border-neutral-300 p-1 text-sm">
        <button
          onClick={() => setTab('curriculum')}
          className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
            tab === 'curriculum' ? 'bg-chalkboard text-white' : 'text-muted-foreground'
          }`}
        >
          Standard exam from curriculum
        </button>
        <button
          onClick={() => setTab('lessons')}
          className={`flex-1 rounded-md px-3 py-2 font-medium transition-colors ${
            tab === 'lessons' ? 'bg-chalkboard text-white' : 'text-muted-foreground'
          }`}
        >
          From my own lessons
        </button>
      </div>

      {tab === 'curriculum' ? (
        <CurriculumExamPicker indicators={indicators} />
      ) : (
        <ExamPicker lessons={lessons} />
      )}
    </div>
  )
}

// Testing steps:
// 1. Visit /exam as a Premium teacher. Expected: "Standard exam from
//    curriculum" tab is selected by default — this is now the primary
//    path since it works with zero lessons generated.
// 2. Switch to "From my own lessons" — expected: the original lesson
//    picker behaviour is unchanged, including its own-subject grouping.
// 3. Generate one exam from each tab and confirm both save correctly and
//    open at /exam/<id> with the right source_type in the database.
