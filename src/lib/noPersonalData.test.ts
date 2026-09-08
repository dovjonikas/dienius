import { expect, test } from 'vitest'
// @ts-expect-error - a plain script, deliberately: the guard has to run from
// a clone with nothing built, and a .ts file would need the toolchain it is
// meant to protect.
import { check, normalise, runsOf } from '../../scripts/no-personal-data.mjs'
import { createHash } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The privacy guard, tested the only way a guard is worth anything: by
// planting what it is looking for and watching it find it. A clean report
// from a check nobody has proved can see a defect says nothing at all.

const hash = (term: string) => createHash('sha256').update(normalise(term)).digest('hex').slice(0, 32)

function repoWith(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'privacy-'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text)
  return { root, files: Object.keys(files) }
}

test('a term on the list is found, and the file and line are named', () => {
  const { root, files } = repoWith({ 'a.ts': 'const x = 1\n// planted: Interactive_Journal\n' })
  const found = check({ files, terms: new Set([hash('Interactive Journal')]), root })
  expect(found).toEqual([{ file: 'a.ts', line: 2, words: 2 }])
})

test('punctuation, case and underscores do not hide a term', () => {
  const terms = new Set([hash('stick season')])
  for (const written of ['stick-season', 'Stick_Season', 'STICK   season', 'stickSeason.json']) {
    const { root, files } = repoWith({ 'a.ts': `path = '${written}'` })
    // camelCase is the one shape this cannot see: there is no separator in
    // "stickSeason" to split on, so it reads as one word. Said out loud here
    // rather than left for somebody to discover.
    const found = check({ files, terms, root })
    if (written === 'stickSeason.json') expect(found).toEqual([])
    else expect(found, written).toHaveLength(1)
  }
})

test('a file with nothing on the list comes back clean', () => {
  const { root, files } = repoWith({ 'a.ts': 'const morning = "Morning routine"\n' })
  expect(check({ files, terms: new Set([hash('Interactive Journal')]), root })).toEqual([])
})

test('an empty list finds nothing rather than everything', () => {
  const { root, files } = repoWith({ 'a.ts': 'anything at all\n' })
  expect(check({ files, terms: new Set(), root })).toEqual([])
})

test('runs of up to four words are compared, and no more', () => {
  const runs = runsOf('one two three four five')
  expect(runs.has('one two three four')).toBe(true)
  expect(runs.has('two three four five')).toBe(true)
  expect(runs.has('one two three four five')).toBe(false)
})

test('every tracked file in this repo is clean', () => {
  // The guard against its own repo, which is the check that actually
  // matters. It runs here rather than only in a script so that `npm test`
  // is enough - a guard nobody remembers to run is not a guard.
  expect(check()).toEqual([])
})
