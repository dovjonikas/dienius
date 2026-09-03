import { isDemoMode } from './demoMode'
import type { AppData } from './types'

/**
 * A week of daily snapshots, in IndexedDB.
 *
 * The export in Settings is deliberately manual - a backup only exists when
 * you actually made one - and that decision stands. What it does not cover is
 * the failure it was never meant to: a mistake. An import of the wrong file,
 * an erase confirmed too fast, a delete that turned out to matter. In every
 * one of those the person did not know a minute earlier that they would want
 * a copy, so "you should have exported" is not advice, it is a shrug.
 *
 * So: one snapshot a day, taken on first open, seven kept. Not a sync, not a
 * history, not undo - a short window in which a bad five minutes is
 * recoverable.
 *
 * IndexedDB rather than localStorage, for one reason: localStorage is where
 * the live data is, and a backup that shares a quota with the thing it is
 * backing up is a backup that disappears exactly when the data grows enough
 * to need it. It is also the only storage here big enough not to care.
 *
 * Every function is best-effort. IndexedDB can be absent (some private
 * modes), blocked, or fail mid-transaction, and none of that may ever stop
 * the app from opening - the whole feature degrades to "there are no
 * snapshots", which is where every install starts anyway.
 */

const DB_NAME = 'dienius-snapshots'
const DB_VERSION = 1
const STORE = 'snapshots'

export const SNAPSHOTS_KEPT = 7

export interface SnapshotMeta {
  /** The date key it was taken on - one per day, so this is also its id. */
  date: string
  /** When exactly, as an ISO instant, for a list that says "this morning". */
  takenAt: string
  /** Rough size of the payload, so the list can say what it is holding. */
  bytes: number
  taskCount: number
  templateCount: number
}

interface SnapshotRecord extends SnapshotMeta {
  data: AppData
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null)
        return
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'date' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      // A blocked open means another tab is holding an older version open.
      // Nothing to do about it and nothing worth waiting for.
      request.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function transact<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      tx.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

function countTasks(data: AppData): number {
  return Object.values(data.days).reduce((n, day) => n + day.tasks.length, 0)
}

/**
 * Takes today's snapshot if there is not one already, and prunes the oldest
 * past `SNAPSHOTS_KEPT`.
 *
 * Keyed by date rather than appended, so opening the app eleven times in a
 * morning writes once. Returns whether it actually wrote, which is only
 * interesting to a test.
 */
export async function snapshotToday(data: AppData, today: string): Promise<boolean> {
  // Never from the sample week. A snapshot is a copy of a real plan to fall
  // back on, and one made of demo data is a trap waiting in the restore list
  // for the day somebody actually needs it.
  if (isDemoMode()) return false
  const db = await openDb()
  if (!db) return false

  const existing = await transact<SnapshotRecord | undefined>(db, 'readonly', store => store.get(today))
  if (existing) {
    db.close()
    return false
  }

  const serialised = JSON.stringify(data)
  const record: SnapshotRecord = {
    date: today,
    takenAt: new Date().toISOString(),
    bytes: serialised.length,
    taskCount: countTasks(data),
    templateCount: data.templates.length,
    // Stored as a parsed clone rather than the live object: structured clone
    // would keep a reference graph nobody wants persisted, and a round trip
    // through JSON is also the cheapest guarantee that what comes back is
    // exactly what `validate` will accept.
    data: JSON.parse(serialised) as AppData,
  }
  await transact(db, 'readwrite', store => store.put(record))

  const keys = await transact<IDBValidKey[]>(db, 'readonly', store => store.getAllKeys())
  if (keys && keys.length > SNAPSHOTS_KEPT) {
    const oldest = keys.map(String).sort().slice(0, keys.length - SNAPSHOTS_KEPT)
    for (const key of oldest) await transact(db, 'readwrite', store => store.delete(key))
  }

  db.close()
  return true
}

/** Every snapshot's metadata, newest first. Never the payloads. */
export async function listSnapshots(): Promise<SnapshotMeta[]> {
  const db = await openDb()
  if (!db) return []
  const all = await transact<SnapshotRecord[]>(db, 'readonly', store => store.getAll())
  db.close()
  if (!all) return []
  return all
    .map(({ date, takenAt, bytes, taskCount, templateCount }) => ({ date, takenAt, bytes, taskCount, templateCount }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** One snapshot's payload, or null when it is gone or unreadable. */
export async function readSnapshot(date: string): Promise<AppData | null> {
  const db = await openDb()
  if (!db) return null
  const record = await transact<SnapshotRecord | undefined>(db, 'readonly', store => store.get(date))
  db.close()
  return record?.data ?? null
}

/** Test seam, and the thing "Erase all data" has to call. */
export async function clearSnapshots(): Promise<void> {
  const db = await openDb()
  if (!db) return
  await transact(db, 'readwrite', store => store.clear())
  db.close()
}
