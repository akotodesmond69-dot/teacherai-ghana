// Purpose: Login page — email/password and Google OAuth, plus a link to reset password.
// Folder: app/login/page.tsx
// Depends on: lib/supabase/client.ts, shadcn/ui Button/Input/Label, next/navigation
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    router.push('/dashboard')
    router.refresh() // ensures server components re-read the new session
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-medium">Log in</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Logging in…' : 'Log in'}
        </Button>
      </form>

      <p className="mt-3 text-sm">
        <Link href="/reset-password" className="underline">Forgot your password?</Link>
      </p>

      <div className="my-4 text-center text-sm text-muted-foreground">or</div>

      <Button variant="outline" onClick={handleGoogleLogin} className="w-full">
        Continue with Google
      </Button>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  )
}

// Testing steps:
// 1. Log in with a confirmed test account. Expected: redirected to /dashboard.
// 2. Try a wrong password. Expected: inline error, no redirect.
// Common error: redirected to /login again right after logging in — usually
// means middleware.ts session refresh and this page's router.refresh() are
// out of sync; confirm cookies are being set (check browser devtools > Application > Cookies).
