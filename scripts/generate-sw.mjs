// Fills in the service worker template after `vite build` has written
// dist/. Vite copies public/sw.js into dist/sw.js verbatim (it does not
// process files under public/), so this script reads that copy, works out
// what got built, and writes the real precache list and a version string
// derived from the content of every file - so the cache name changes
// whenever anything in the build changes, even if no filename does.
//
// Keep BASE_PATH in sync with `base` in vite.config.ts by hand: this script
// runs as plain Node after the Vite build, outside the Vite config graph,
// so there is no automatic way to share the value between the two.

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_PATH = '/dienius/'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const rootDir = join(scriptDir, '..')
const distDir = join(rootDir, 'dist')
const swPath = join(distDir, 'sw.js')

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.flatMap(entry => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const files = walk(distDir)
  .filter(file => statSync(file).isFile())
  .map(file => relative(distDir, file).split(sep).join('/'))
  .filter(rel => rel !== 'sw.js')
  .sort()

if (files.length === 0) {
  throw new Error('generate-sw: no built files found in dist/, did vite build run first?')
}

const hash = createHash('sha1')
for (const rel of files) {
  hash.update(readFileSync(join(distDir, rel)))
}
const version = hash.digest('hex').slice(0, 12)

const precacheUrls = files.map(rel => BASE_PATH + rel)
const indexUrl = BASE_PATH + 'index.html'

if (!precacheUrls.includes(indexUrl)) {
  throw new Error('generate-sw: expected an index.html in the build output')
}

const template = readFileSync(swPath, 'utf8')
const output = template
  .replace('__CACHE_VERSION__', version)
  .replace('__PRECACHE_URLS__', JSON.stringify(precacheUrls))
  .replace('__INDEX_URL__', indexUrl)

writeFileSync(swPath, output)

console.log(`generate-sw: cache dienius-${version} with ${precacheUrls.length} precached files`)
