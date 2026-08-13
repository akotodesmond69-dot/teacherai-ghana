// Purpose: Sign-up page — email/password and Google OAuth.
// Folder: app/signup/page.tsx
// Depends on: lib/supabase/client.ts, shadcn/ui Button/Input/Label
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SignUpPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // school_name is passed as metadata — the Phase 4 trigger reads this
    // to fill in the teachers row automatically.
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { school_name: schoolName } },
    })

    setLoading(false)
    setMessage(
      error ? error.message : 'Check your email to confirm your account.'
    )
  }

  async function handleGoogleSignUp() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-medium">Create your account</h1>

      <form onSubmit={handleEmailSignUp} className="space-y-4">
        <div>
          <Label htmlFor="school">School name</Label>
          <Input id="school" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>

      <div className="my-4 text-center text-sm text-muted-foreground">or</div>

      <Button variant="outline" onClick={handleGoogleSignUp} className="w-full">
        Continue with Google
      </Button>

      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  )
}

// Testing steps:
// 1. Fill the form, submit. Expected: confirmation email sent (Supabase default).
// 2. Check Supabase dashboard > Table Editor > teachers. Expected: new row
//    with school_name filled in, subscription_tier = 'free'.
// Common error: "Email not confirmed" on first login — expected behavior;
// Supabase requires email confirmation by default (configurable in dashboard).
