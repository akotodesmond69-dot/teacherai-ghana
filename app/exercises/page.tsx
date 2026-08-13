// Purpose: Entry page for the Exercise/Homework Generator — Premium-gated
// server-side, then hands off to the client uploader.
// Folder: app/exercises/page.tsx

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasActivePremium } from '@/lib/payments/plans'
import { AppNav } from '@/components/app-nav'
import { ExerciseUploader } from './uploader'

export default async function ExercisesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('subscription_tier, subscription_expires_at')
    .eq('id', user.id)
    .single()

  const isPremium = teacher ? hasActivePremium(teacher) : false

  if (!isPremium) {
    return (
      <>
        <AppNav />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="mb-2 text-2xl font-medium">Exercise &amp; Homework Generator</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Upload a PDF, Word document, or a photo of a book page — TeacherAI
            will generate questions and a marking scheme from it. Premium feature.
          </p>
          <Link href="/billing" className="inline-block rounded-md bg-gold-thread px-6 py-3 text-sm font-medium text-amber-950">
            Upgrade to Premium
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="mb-1 text-2xl font-medium">Exercise &amp; Homework Generator</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Upload a PDF, Word document, or photo of a book page.
        </p>
        <ExerciseUploader />
      </div>
    </>
  )
}
