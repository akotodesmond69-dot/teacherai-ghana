// Purpose: The public landing page at "/" — the first thing a visitor sees.
// Folder: app/page.tsx
// Design follows Phase 2's landing page mockup: chalkboard green + gold accent.

import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <div className="mb-5 inline-block rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-800">
        Aligned with the NaCCA curriculum
      </div>
      <h1 className="mb-4 font-display text-4xl font-medium leading-tight text-chalkboard">
        Lesson notes, done before your next class.
      </h1>
      <p className="mx-auto mb-8 max-w-md text-neutral-600">
        Pick your class, subject, and indicator. TeacherAI writes a complete,
        curriculum-aligned lesson note in under a minute.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-gold-thread px-6 py-3 text-sm font-medium text-amber-950"
        >
          Generate my first lesson
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-neutral-300 px-6 py-3 text-sm font-medium text-ink"
        >
          Log in
        </Link>
      </div>
    </div>
  )
}
