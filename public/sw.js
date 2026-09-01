/*
 * Offline support for the installed app.
 *
 * Practising should not depend on a signal — the only thing here that needs the
 * network is Spotify, and that is left alone entirely so nothing caches a
 * search result or, worse, a token response.
 */
const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`
const SHELL_URL = '/'

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      await cache.addAll([SHELL_URL, '/manifest.webmanifest', '/icon-192.png', '/apple-touch-icon.png'])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, ASSETS])
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Anything not served by this app — Spotify's API, album art — goes straight
  // to the network and is never stored.
  if (url.origin !== self.location.origin) return

  // The page itself: take the network's answer when there is one, so a new
  // deployment is picked up on the next load rather than days later.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request)
          const cache = await caches.open(SHELL)
          cache.put(SHELL_URL, fresh.clone())
          return fresh
        } catch {
          return (await caches.match(SHELL_URL)) ?? Response.error()
        }
      })(),
    )
    return
  }

  // Built assets carry a content hash in their name, so a cached copy can never
  // be out of date: serve it immediately and only reach out when it is missing.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(request)
        if (hit) return hit
        const fresh = await fetch(request)
        if (fresh.ok) (await caches.open(ASSETS)).put(request, fresh.clone())
        return fresh
      })(),
    )
    return
  }

  // Icons and the manifest: show what is cached, refresh it quietly behind.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL)
      const hit = await cache.match(request)
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone())
          return res
        })
        .catch(() => hit ?? Response.error())
      return hit ?? network
    })(),
  )
})
