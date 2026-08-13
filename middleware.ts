// Purpose: Refresh the Supabase session on every request, and redirect
// unauthenticated users away from private pages (like the dashboard).
// Folder: middleware.ts (project root — Next.js requires this exact location)
// Depends on: @supabase/ssr

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/generate', '/generate-language', '/lesson', '/assessment', '/scheme', '/assistant', '/billing', '/curriculum', '/exam', '/profile', '/exercises', '/admin']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        // Same fix as lib/supabase/server.ts: derive the options type from
        // response.cookies.set's own signature, rather than leaving it
        // implicit — required by our tsconfig's strict mode.
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof response.cookies.set>[2] }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // This call both refreshes the session AND tells us if someone is logged in.
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

// Testing steps:
// 1. Log out, visit /dashboard directly. Expected: redirected to /login.
// 2. Log in, visit /dashboard. Expected: page loads normally.
// Common error: infinite redirect loop — usually means /login itself got
// matched by PROTECTED_PATHS. Double check the matcher/paths don't overlap.
