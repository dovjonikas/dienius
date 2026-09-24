/**
 * What the built script is made of: every byte attributed to the source file
 * it came from, by the build's own source map, and grouped by folder - the
 * freeze's point 4, "the bundle and what makes it up". docs/SPEED.md has the
 * numbers it gave.
 *
 *   npx vite build --sourcemap --outDir <folder> && node scripts/bundle-parts.mjs <folder>
 *
 * A folder of its own, never dist: a source map in dist would be deployed,
 * and precached by the worker with everything else.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const dir = process.argv[2]
if (!dir) throw new Error('Name the folder a build with --sourcemap went into.')
const assets = readdirSync(join(dir, 'assets'))
const js = assets.find(f => f.endsWith('.js'))
const css = assets.find(f => f.endsWith('.css'))
if (!js || !css) throw new Error(`No script or stylesheet in ${dir}/assets.`)
const code = readFileSync(join(dir, 'assets', js), 'utf8')
/** @type {{ sources: string[], mappings: string }} */
const map = JSON.parse(readFileSync(join(dir, 'assets', `${js}.map`), 'utf8'))

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
/** One segment of a source map, its base-64 VLQ fields read out. @param {string} text */
function vlq(text) {
  /** @type {number[]} */
  const out = []
  let value = 0
  let shift = 0
  for (const ch of text) {
    let digit = B64.indexOf(ch)
    const more = digit & 32
    digit &= 31
    value += digit << shift
    if (more) {
      shift += 5
    } else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1)
      value = 0
      shift = 0
    }
  }
  return out
}

// The source index runs on across lines; the column starts again on each.
const lines = code.split('\n')
/** @type {Map<string, number>} */
const bytes = new Map()
let source = 0
map.mappings.split(';').forEach((line, index) => {
  const text = lines[index] ?? ''
  let column = 0
  /** @type {{ column: number, source: number }[]} */
  const starts = []
  for (const seg of line.split(',').filter(Boolean).map(vlq)) {
    column += seg[0]
    if (seg.length > 1) source += seg[1]
    starts.push({ column, source: seg.length > 1 ? source : -1 })
  }
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].column : text.length
    const name = s.source >= 0 ? map.sources[s.source] : '(no source)'
    bytes.set(name, (bytes.get(name) ?? 0) + Math.max(0, end - s.column))
  })
})

/** A source's path from the repo's root. @param {string} name */
const rel = name => name.split('\\').join('/').replace(/^(\.\.\/)+/, '').replace(/^.*?\/(?=src\/|node_modules\/)/, '')
/** The folder a source counts under: a package, or src and one or two levels. @param {string} name */
const group = name => {
  const clean = rel(name)
  if (clean.includes('node_modules/')) return `node_modules/${clean.split('node_modules/')[1].split('/')[0]}`
  const parts = clean.split('/')
  if (parts[0] !== 'src') return clean
  if (parts.length === 2) return 'src (the shell)'
  return parts.slice(0, parts[1] === 'views' || parts[1] === 'widgets' ? Math.min(3, parts.length - 1) : 2).join('/')
}
/** @type {Map<string, number>} */
const groups = new Map()
for (const [name, n] of bytes) groups.set(group(name), (groups.get(group(name)) ?? 0) + n)

const total = code.length
/** @param {number} n */
const kb = n => `${(n / 1024).toFixed(1).padStart(7)} KB`
/** @param {number} n */
const share = n => `${((100 * n) / total).toFixed(1).padStart(5)}%`
const sheet = readFileSync(join(dir, 'assets', css))
console.log(`${js}: ${kb(total)} raw, ${kb(gzipSync(code).length)} gzip`)
console.log(`${css}: ${kb(sheet.length)} raw, ${kb(gzipSync(sheet).length)} gzip`)
console.log('\nThe script, by folder:')
for (const [g, n] of [...groups].sort((a, b) => b[1] - a[1])) console.log(`${kb(n)}  ${share(n)}  ${g}`)
console.log('\nThe largest files:')
for (const [name, n] of [...bytes].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`${kb(n)}  ${share(n)}  ${rel(name)}`)
