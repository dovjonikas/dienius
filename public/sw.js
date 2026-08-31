// Dienius service worker.
//
// The app has no backend, so this is purely a static asset cache: it makes
// the planner open and work fully offline after the first visit. Every
// build gets its own cache name (see scripts/generate-sw.mjs), so a fresh
// deploy is never pinned behind a stale cache - the new worker installs,
// takes over immediately, and clears out whatever the previous version left
// behind.
//
// CACHE_VERSION, PRECACHE_URLS and INDEX_URL are filled in at build time by
// scripts/generate-sw.mjs. Do not edit them by hand - edit the script
// instead and rebuild.

const CACHE_NAME = 'dienius-__CACHE_VERSION__'
const PRECACHE_URLS = __PRECACHE_URLS__
const INDEX_URL = '__INDEX_URL__'

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return

  // A ranged request answered with a cached, whole response would hand
  // back far more than was asked for - and a 206 Partial Content response
  // has response.ok === true, so it would otherwise get cached here and
  // later served whole in place of a partial one. Leave these to the
  // network entirely. The app has no audio or video today, so this is a
  // defensive guard against a known service worker pitfall rather than
  // something currently exercised.
  if (request.headers.has('range')) return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
    return
  }

  event.respondWith(cacheFirst(request))
})

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    const cached = await caches.match(request)
    return cached || (await caches.match(INDEX_URL))
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    return cached
  }
}
