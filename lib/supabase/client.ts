// Purpose: Supabase client for use inside browser-rendered ("use client") components.
// Folder: lib/supabase/client.ts
// Depends on: @supabase/ssr, @supabase/supabase-js
// How it works: this client reads/writes the session using browser cookies
// automatically. Use this ONLY inside components marked "use client".

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// NOTE: NEXT_PUBLIC_ prefixed env vars are bundled into the browser JS bundle
// — this is safe here because the "anon key" is designed to be public; it has
// no power on its own without RLS policies (Phase 3) granting access.
// The service_role key (which bypasses RLS) must NEVER be prefixed
// with NEXT_PUBLIC_ and must never be used in client code.
