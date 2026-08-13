// Purpose: Supabase client for use in server components, server actions,
// and route handlers.
// Folder: lib/supabase/server.ts
// Depends on: @supabase/ssr, next/headers
// How it works: reads the session from the incoming request's cookies
// (set by middleware.ts) so the server knows which teacher is logged in
// without the browser needing to send anything extra.

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        // WHY the explicit type here: TypeScript's strict mode (enabled in
        // our tsconfig) requires every function parameter to have a known
        // type — it won't silently infer one, even though this callback's
        // shape is implied by createServerClient's expectations. Deriving
        // the options type directly from cookieStore.set's own signature
        // (via `Parameters<...>`) means this stays correct automatically
        // even if Next.js's cookie types change in a future version.
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component that can't set cookies directly —
            // safe to ignore because middleware.ts refreshes the session anyway.
          }
        },
      },
    }
  )
}
