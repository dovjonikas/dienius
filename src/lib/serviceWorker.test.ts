import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * `public/sw.js` itself, run against a stand-in for the worker's world: the
 * template with its three blanks filled the way scripts/generate-sw.mjs fills
 * them, a cache that holds nothing, and a network that is gone.
 */
function workerWithNothingCachedAndNoNetwork(networkError: Error) {
  const listeners: Record<string, (event: unknown) => void> = {}
  const self = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener
    },
    location: { origin: 'https://example.test' },
  }
  const emptyCache = { match: async () => undefined, put: async () => undefined }
  const caches = { open: async () => emptyCache, match: async () => undefined }
  const fetch = async () => {
    throw networkError
  }
  const source = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')
    .replace('__CACHE_VERSION__', 'test')
    .replace('__PRECACHE_URLS__', '[]')
    .replace('__INDEX_URL__', '/dienius/')
  new Function('self', 'caches', 'fetch', source)(self, caches, fetch)
  return listeners
}

// A file that is neither cached nor reachable cannot be served either way;
// what was lost was only the reason. The catch handed the browser the cache
// miss it already had - undefined, never a response - so a real failure read
// as a bare "not a Response" with the network's own error thrown away.
test('an uncached file with no network fails with the network error, not an empty answer', async () => {
  const offline = new TypeError('Failed to fetch')
  const listeners = workerWithNothingCachedAndNoNetwork(offline)
  let answer: Promise<unknown> | undefined
  listeners.fetch({
    request: new Request('https://example.test/dienius/assets/index.js'),
    respondWith: (promise: Promise<unknown>) => {
      answer = promise
    },
  })

  await expect(answer).rejects.toBe(offline)
})
