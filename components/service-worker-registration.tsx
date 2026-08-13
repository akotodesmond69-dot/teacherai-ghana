// Purpose: Registers public/sw.js when the app loads in a browser. This
// has to be a client component — service worker registration is a browser
// API, not something that can run on the server.
// Folder: components/service-worker-registration.tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err)
      })
    }
  }, [])

  return null
}
