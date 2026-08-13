// Purpose: Root layout — wraps every page in the app. Required by Next.js's
// App Router (every app/ directory needs exactly one root layout.tsx).
// Also wires up the PWA manifest, icons, and service worker so the app is
// installable to a phone's home screen.
// Folder: app/layout.tsx

import './globals.css'
import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'

export const metadata: Metadata = {
  title: 'TeacherAI Ghana',
  description: 'AI-powered lesson notes aligned with the NaCCA curriculum',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/icons/icon-180.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1F4D3E',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}

