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

// Every lookup ignores Vary. The cache holds one build of one origin's
// files, so a URL is the whole of what a response is - and a server that
// answers `Vary: Origin` (vite's preview does) made each precached script
// and stylesheet a miss for the page's own request, which carries an Origin
// the precaching request did not: the app opened offline as an empty page.
// GitHub Pages answers `Vary: Accept-Encoding` today, which happens to
// match; this does not rest on that. See the freeze's point 3, and
// e2e/offline.e2e.ts, which found it.
const ANY = { ignoreVary: true }

// This build's own files first, then any cache still standing. A worker
// that has just taken over is in charge before its activate step has
// cleared the build before it away, and a lookup across every cache found
// the old build's page first: the app opened after a deploy asked for a
// reload into what it already was. The old caches are the last resort, for
// a page of the old build that is still open with no network.
async function cached(request) {
  const own = await caches.open(CACHE_NAME)
  return (await own.match(request, ANY)) || (await caches.match(request, ANY))
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    return (await cached(request)) || (await cached(INDEX_URL))
  }
}

async function cacheFirst(request) {
  const hit = await cached(request)
  if (hit) return hit
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch (err) {
    return hit
  }
}
