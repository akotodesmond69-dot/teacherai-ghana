// Purpose: Handles the redirect back from Google after OAuth login,
// exchanging the temporary auth code for a real Supabase session.
// Folder: app/auth/callback/route.ts
// Depends on: lib/supabase/server.ts
// How it works: Google redirects here with a `code` query param after the
// user approves login. We exchange that code for a session, which sets
// the session cookies, then redirect the user into the app.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/dashboard`)
    }
  }

  // Something went wrong — send them back to login with an error flag.
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}

// Testing steps:
// 1. Click "Continue with Google" on /login or /signup.
// 2. Approve the Google consent screen.
// Expected: redirected back to /dashboard, logged in.
// Common error: "redirect_uri_mismatch" from Google — the callback URL
// registered in Google Cloud Console and Supabase's Auth > Providers > Google
// settings must match this route's full URL EXACTLY (including https:// and
// no trailing slash).
