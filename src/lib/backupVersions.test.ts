import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { exportJson, importJson, loadData, STORAGE_KEY } from './storage'

/**
 * Every backup format since v2.20, each file written by its own version.
 *
 * `scripts/backup-fixtures.mjs` checked out, in a worktree, each commit that
 * changed the plan's shape and let that version's own code write the file:
 * the sample day, and a generic overlay of every field its guard knew - a
 * night kind, a week template, a routine, a meal block, a recipe, a course.
 * So each file is what that version really wrote, not what this one thinks
 * it wrote. Two commits that wrote the same bytes keep one file between
 * them. docs/BACKUP-FORMAT.md section 5 says what each version added.
 *
 * Four promises, on every file:
 * - it opens in this version without an error, the same by import as from
 *   the device's own storage;
 * - nothing in it is lost: every value is where it was, or where one of the
 *   migrations below moved it;
 * - nothing appears in it but what those migrations add;
 * - after one import it is a fixed point - exported, imported and exported
 *   again, byte for byte the same - and a file from v2.29 on, with nothing
 *   to migrate, is byte for byte the file it was.
 *
 * Where a file breaks one, the migration is what gets fixed, not the file.
 */

const DIR = join(__dirname, 'fixtures', 'backups')
const FILES = readdirSync(DIR).filter(name => name.endsWith('.json')).sort(byVersion)

function versionOf(name: string): number {
  const [, major, minor] = name.match(/v(\d+)\.(\d+)/) ?? ['', '0', '0']
  return Number(major) * 1000 + Number(minor)
}

function byVersion(a: string, b: string): number {
  return versionOf(a) - versionOf(b) || a.localeCompare(b)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
})

/** Every leaf of a plan by its path, naming a list's members by id where they have one. */
function leaves(value: unknown, path = '', out = new Map<string, unknown>()): Map<string, unknown> {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(path, '[]')
    value.forEach((item, i) => {
      const id = item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id : undefined
      leaves(item, `${path}[${id ?? i}]`, out)
    })
  } else if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) out.set(path, '{}')
    for (const [key, v] of entries) leaves(v, path ? `${path}.${key}` : key, out)
  } else {
    out.set(path, value)
  }
  return out
}

/**
 * What an import does to a file from before v2.29, and nothing else:
 * - a goal still open is retired, since v2.28 - archived that minute, its
 *   words offered to North (north.ts `retireGoals`). Its title, its why and
 *   the rest stay; `archivedAt` and `updatedAt` say when;
 * - a plan with no recipes has an empty list of them, since v2.27, and one
 *   with no routines an empty list of those, since v2.29 (storage.ts
 *   `normalizeLoaded`) - absent and empty mean the same, BACKUP-FORMAT
 *   section 2.
 */
const CHANGED: RegExp[] = [/^goals\[[^\]]+\]\.updatedAt$/]
const ADDED: RegExp[] = [/^goals\[[^\]]+\]\.archivedAt$/, /^recipes$/, /^routines$/]

describe.each(FILES)('%s', name => {
  const text = readFileSync(join(DIR, name), 'utf8')

  test('opens without an error, the same by import as from storage', () => {
    const imported = importJson(text)
    localStorage.setItem(STORAGE_KEY, text)
    expect(loadData()).toEqual(imported)
  })

  test('loses nothing, and gains only what a migration adds', () => {
    const before = leaves(JSON.parse(text))
    const after = leaves(JSON.parse(exportJson(importJson(text))))
    const lost: string[] = []
    for (const [path, value] of before) {
      if (after.has(path) && Object.is(after.get(path), value)) continue
      const now = after.get(path)
      // A later instant, never an earlier one or none.
      if (CHANGED.some(re => re.test(path)) && typeof value === 'string' && typeof now === 'string' && now >= value) continue
      lost.push(`${path}: ${JSON.stringify(value)} -> ${JSON.stringify(now)}`)
    }
    expect(lost).toEqual([])
    const gained = [...after.keys()].filter(path => !before.has(path) && !ADDED.some(re => re.test(path)))
    expect(gained).toEqual([])
  })

  test('after one import, export is a fixed point, byte for byte', () => {
    const once = exportJson(importJson(text))
    expect(exportJson(importJson(once))).toBe(once)
  })

  test.runIf(versionOf(name) >= 2029)('from v2.29 on, the same file back, byte for byte', () => {
    expect(exportJson(importJson(text))).toBe(text)
  })
})

test('every format since v2.20 is here, the oldest and the newest among them', () => {
  expect(FILES.length).toBeGreaterThanOrEqual(19)
  expect(FILES[0]).toMatch(/^backup-v2\.20-/)
  expect(FILES[FILES.length - 1]).toMatch(/^backup-v2\.40-/)
})
