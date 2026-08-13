// Purpose: Lets a teacher request a password reset email.
// Folder: app/reset-password/page.tsx
// Depends on: lib/supabase/client.ts
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/update-password`,
    })
    setMessage(error ? error.message : 'Check your email for a reset link.')
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-medium">Reset your password</h1>
      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full">Send reset link</Button>
      </form>
      {message && <p className="mt-4 text-sm">{message}</p>}
    </div>
  )
}
