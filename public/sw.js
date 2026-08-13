// Purpose: A minimal service worker — its main job is simply to EXIST,
// since browsers require a registered service worker with a fetch handler
// before they'll consider the app "installable" as a PWA. On top of that
// baseline requirement, it does one small useful thing: caches the app's
// icons and manifest so they still load even on a flaky connection.
// Folder: public/sw.js (must be at the root, not in a subfolder — a
// service worker can only control paths at or below its own location)

const CACHE_NAME = 'teacherai-ghana-v1'
const PRECACHE_URLS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
})

self.addEventListener('activate', (event) => {
  // Clean up any old cache versions from a previous deploy.
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  )
})

self.addEventListener('fetch', (event) => {
  // WHY network-first, not cache-first: this app is data-driven (AI
  // generation, live curriculum data) — showing stale cached content
  // instead of fresh data would be actively wrong for a teacher relying
  // on this. We only fall back to cache if the network genuinely fails.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
