// Purpose: A Supabase client using the service_role key, for server code
// that either has no logged-in user to read a session from (the Paystack
// webhook), or deliberately needs to bypass RLS for a trusted write (the
// billing actions writing to the payments table). Used by:
// app/billing/actions.ts, app/billing/callback/page.tsx,
// app/api/paystack/webhook/route.ts, and scripts/seed-curriculum.ts.
// This bypasses RLS entirely, so it must NEVER be imported into any client
// component or any code path that runs based on unverified user input.
// IMPORTANT: SUPABASE_SERVICE_ROLE_KEY must be set as a real environment
// variable in your DEPLOYMENT platform (Vercel, etc.), not just your local
// .env.local — every one of the files above runs in production, not only
// on your own machine.
// Folder: lib/supabase/service.ts
// Depends on: @supabase/supabase-js (not @supabase/ssr — no cookies involved)

import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // WHY this explicit check, instead of letting a missing key fail
  // wherever it happens to be used: without it, a missing environment
  // variable produces a vague, hard-to-diagnose crash deep inside
  // Supabase's client code. This turns that into one clear, obvious
  // message pointing at the actual cause.
  if (!url || !serviceKey) {
    throw new Error(
      'createServiceClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'If this is happening in production, add SUPABASE_SERVICE_ROLE_KEY in your deployment platform\'s environment variables.'
    )
  }

  return createClient(url, serviceKey)
}
