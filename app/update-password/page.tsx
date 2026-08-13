// Purpose: Lets a teacher set a new password after clicking the reset email link.
// Folder: app/update-password/page.tsx
// Depends on: lib/supabase/client.ts, next/navigation
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      return
    }
    router.push('/login')
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-medium">Choose a new password</h1>
      <form onSubmit={handleUpdate} className="space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </div>
        <Button type="submit" className="w-full">Update password</Button>
      </form>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  )
}

// Testing steps for the whole reset flow:
// 1. On /reset-password, submit a real test email.
// 2. Open the email, click the link — should land on /update-password already logged in.
// 3. Set a new password, submit. Expected: redirected to /login.
// 4. Log in with the new password. Expected: success.
// Common error: link lands on /update-password but user isn't authenticated —
// check that Supabase's "Reset Password" redirect URL (in Auth settings) is
// allow-listed, and matches this route exactly.
