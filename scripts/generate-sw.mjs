// Fills in the service worker template after Vite has written the build
// output. Vite copies public/sw.js into the output directory verbatim (it
// does not process files under public/), so this reads that copy, works out
// what got built, and writes the real precache list and a version string
// derived from the content of every file - so the cache name changes
// whenever anything in the build changes, even if no filename does.
//
// `base` is passed in by the caller (see the `closeBundle` hook in
// vite.config.ts) rather than hardcoded here, so there is exactly one place
// in the repo - Vite's own `base` config - that the deployed subpath comes
// from. Nothing can drift out of step with it.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap(entry => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

/**
 * @param {object} options
 * @param {string} options.distDir absolute path to the build output directory
 * @param {string} options.base Vite's resolved `base`, e.g. "/dienius/"
 * @returns {{ version: string, precacheUrls: string[] }}
 */
export function generateServiceWorker({ distDir, base }) {
  const swPath = join(distDir, 'sw.js')

  const files = walk(distDir)
    .filter(file => statSync(file).isFile())
    .map(file => relative(distDir, file).split(sep).join('/'))
    .filter(rel => rel !== 'sw.js')
    .sort()

  if (files.length === 0) {
    throw new Error('generate-sw: no built files found, did vite build run first?')
  }

  const hash = createHash('sha1')
  for (const rel of files) {
    hash.update(readFileSync(join(distDir, rel)))
  }
  const version = hash.digest('hex').slice(0, 12)

  const precacheUrls = files.map(rel => base + rel)
  const indexUrl = base + 'index.html'

  if (!precacheUrls.includes(indexUrl)) {
    throw new Error('generate-sw: expected an index.html in the build output')
  }

  const template = readFileSync(swPath, 'utf8')
  for (const placeholder of ['__CACHE_VERSION__', '__PRECACHE_URLS__', '__INDEX_URL__']) {
    if (!template.includes(placeholder)) {
      throw new Error(`generate-sw: sw.js is missing the ${placeholder} placeholder, cannot fill it in`)
    }
  }
  const output = template
    .replace('__CACHE_VERSION__', version)
    .replace('__PRECACHE_URLS__', JSON.stringify(precacheUrls))
    .replace('__INDEX_URL__', indexUrl)

  writeFileSync(swPath, output)

  return { version, precacheUrls }
}
