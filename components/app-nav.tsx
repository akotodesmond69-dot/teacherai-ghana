// Purpose: The persistent navigation bar — Dashboard/Home, every main
// feature, Profile, Billing, and Log out. Rebuilt with a real mobile menu:
// on a phone-width screen, links collapse behind a hamburger toggle
// instead of wrapping into a cluttered multi-row cluster of text.
// Folder: components/app-nav.tsx
// WHY this is now a Client Component (unlike the original version): the
// hamburger toggle needs on-screen state (open/closed) that only exists in
// the browser. The logout button still works exactly the same way as
// before — a <form> posting directly to a server action, callable from a
// client component just like any other server action.
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOutAction } from './app-nav-actions'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/generate', label: 'Generate Lesson' },
  { href: '/generate-language', label: 'Languages & French' },
  { href: '/assessment', label: 'Assessments' },
  { href: '/scheme', label: 'Schemes' },
  { href: '/exam', label: 'Exams' },
  { href: '/exercises', label: 'Exercises' },
  { href: '/assistant', label: 'Assistant' },
]

const SECONDARY_LINKS = [
  { href: '/profile', label: 'Profile' },
  { href: '/billing', label: 'Billing' },
]

export function AppNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <nav className="mb-6 border-b bg-white">
      {/* Top row: always visible on every screen size */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="font-medium text-chalkboard" onClick={() => setMenuOpen(false)}>
          TeacherAI Ghana
        </Link>

        {/* Desktop links — hidden below the sm breakpoint, shown at sm and up */}
        <div className="hidden items-center gap-4 sm:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm hover:text-chalkboard ${
                pathname.startsWith(link.href) ? 'font-medium text-chalkboard' : 'text-neutral-600'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <span className="h-4 w-px bg-neutral-300" />
          {SECONDARY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm text-neutral-600 hover:text-chalkboard">
              {link.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button type="submit" className="text-sm text-neutral-600 hover:text-red-600">
              Log out
            </button>
          </form>
        </div>

        {/* Hamburger button — only visible below the sm breakpoint */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md border sm:hidden"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <span className="text-lg leading-none">✕</span>
          ) : (
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-5 bg-ink" />
              <span className="block h-0.5 w-5 bg-ink" />
              <span className="block h-0.5 w-5 bg-ink" />
            </span>
          )}
        </button>
      </div>

      {/* Mobile dropdown panel — only rendered when open, only relevant below sm */}
      {menuOpen && (
        <div className="flex flex-col gap-1 border-t px-4 py-3 sm:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`rounded-md px-2 py-2 text-sm ${
                pathname.startsWith(link.href) ? 'bg-notebook font-medium text-chalkboard' : 'text-neutral-700'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-1 border-t" />
          {SECONDARY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-md px-2 py-2 text-sm text-neutral-700"
            >
              {link.label}
            </Link>
          ))}
          <form action={signOutAction}>
            <button type="submit" className="w-full rounded-md px-2 py-2 text-left text-sm text-red-600">
              Log out
            </button>
          </form>
        </div>
      )}
    </nav>
  )
}

// Testing steps:
// 1. On a desktop-width browser window, confirm the nav looks the same as
//    before — logo, inline links, Profile/Billing/Logout, no hamburger.
// 2. Shrink the browser window (or open on a real phone) below ~640px
//    wide. Expected: the inline links disappear, a hamburger button
//    appears on the right.
// 3. Tap the hamburger. Expected: a clean vertical list of every link
//    drops down below the bar, easy to tap, not cramped.
// 4. Tap any link in the mobile menu. Expected: navigates there AND the
//    menu closes automatically (via the onClick handler), so it doesn't
//    stay open covering the next page.
// 5. Confirm the current page's link is visually highlighted (bold,
//    tinted background) in both desktop and mobile views.
