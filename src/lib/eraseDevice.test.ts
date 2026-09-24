import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { DATABASES, DATABASE_WAIT_MS, eraseThisDevice } from './eraseDevice'

/**
 * "Erase all data" - the owner's report of 2026-09-22: erased on the
 * computer, and the day was back a second later. Sync was still switched on,
 * with its token, so the plan walked straight back in from GitHub.
 *
 * And the freeze's look at what the code no longer uses, 2026-09-24: the
 * photographs in the notes and the files picked for the Library stayed in
 * their own databases after an erase that said it removed everything.
 */

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

/** An IndexedDB that only deletes, a moment after it is asked, and says what it deleted. */
function databasesThatDelete() {
  const deleted: string[] = []
  const factory = {
    deleteDatabase(name: string) {
      const request: { onsuccess?: () => void } = {}
      setTimeout(() => {
        deleted.push(name)
        request.onsuccess?.()
      })
      return request
    },
  } as unknown as IDBFactory
  return { factory, deleted }
}

test('an erase takes every key this app wrote on this device, and nothing else', async () => {
  localStorage.setItem('dienius:data', '{"days":{}}')
  localStorage.setItem('dienius:sync', '{"enabled":true,"via":"github"}')
  localStorage.setItem('dienius:sync-device', '{"joinedAt":"2026-09-22T06:00:00.000Z"}')
  localStorage.setItem('dienius:cloud-backup', '{"repo":"someone/plans","token":"a token"}')
  localStorage.setItem('dienius:clock-tools', '{}')
  localStorage.setItem('somebody-elses-app', 'kept')
  sessionStorage.setItem('dienius:tour', 'running')
  sessionStorage.setItem('theirs', 'kept')

  await eraseThisDevice()

  const left = []
  for (let i = 0; i < localStorage.length; i++) left.push(localStorage.key(i))
  expect(left).toEqual(['somebody-elses-app'])
  expect(sessionStorage.getItem('dienius:tour')).toBeNull()
  expect(sessionStorage.getItem('theirs')).toBe('kept')
})

test('the token and the sync switch go with it, so nothing pulls the plan back', async () => {
  localStorage.setItem('dienius:cloud-backup', '{"repo":"someone/plans","token":"a token"}')
  localStorage.setItem('dienius:sync', '{"url":"","token":"","enabled":true,"via":"github"}')

  await eraseThisDevice()

  expect(localStorage.getItem('dienius:cloud-backup')).toBeNull()
  expect(localStorage.getItem('dienius:sync')).toBeNull()
})

test('an erase on a device with nothing on it is not an error', async () => {
  await expect(eraseThisDevice()).resolves.toBeUndefined()
})

test('an erase takes the photographs, the picked files and the snapshots too', async () => {
  const databases = databasesThatDelete()

  await eraseThisDevice(databases.factory)

  expect([...databases.deleted].sort()).toEqual(['dienius-files', 'dienius-photos', 'dienius-snapshots'])
})

test('the keys go once the databases have, so the reload comes straight after them', async () => {
  localStorage.setItem('dienius:data', '{"days":{}}')
  const databases = databasesThatDelete()

  const erasing = eraseThisDevice(databases.factory)
  expect(localStorage.getItem('dienius:data')).not.toBeNull()
  await erasing

  expect(databases.deleted).toHaveLength(3)
  expect(localStorage.getItem('dienius:data')).toBeNull()
})

test('a database that never answers does not hold the erase up', async () => {
  vi.useFakeTimers()
  localStorage.setItem('dienius:data', '{"days":{}}')
  const silent = { deleteDatabase: () => ({}) } as unknown as IDBFactory

  const erasing = eraseThisDevice(silent)
  await vi.advanceTimersByTimeAsync(DATABASE_WAIT_MS)
  await erasing

  expect(localStorage.getItem('dienius:data')).toBeNull()
})

test('a database that refuses to be deleted does not stop the rest', async () => {
  localStorage.setItem('dienius:data', '{"days":{}}')
  const refusing = {
    deleteDatabase: () => {
      throw new Error('not here')
    },
  } as unknown as IDBFactory

  await eraseThisDevice(refusing)

  expect(localStorage.getItem('dienius:data')).toBeNull()
})

test('every database the app opens is one an erase deletes', () => {
  const src = resolve(process.cwd(), 'src')
  const files = (function walk(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return walk(full)
      return /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.') ? [full] : []
    })
  })(src)

  const opened: string[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!/indexedDB\.open\(/.test(text)) continue
    const names = [...text.matchAll(/DB_NAME = '([^']+)'|indexedDB\.open\(\s*'([^']+)'/g)].map(m => m[1] ?? m[2])
    expect(names, `${relative(src, file)} opens a database this test cannot name`).not.toHaveLength(0)
    opened.push(...names)
  }

  expect([...new Set(opened)].sort()).toEqual([...DATABASES].sort())
})
