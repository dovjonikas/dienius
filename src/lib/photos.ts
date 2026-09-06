/**
 * Photographs in a note, and the one place they live.
 *
 * A screenshot is a note somebody took with a camera instead of a keyboard -
 * a meal plan, a receipt, a whiteboard, the error the app just showed - and
 * scratch is where a thing goes when there is no time to decide where it
 * goes. So a note can carry pictures. What it must not do is carry them
 * anywhere the rest of the app goes.
 *
 * **Not localStorage.** The whole plan lives under one localStorage key with
 * roughly five megabytes for all of it. One photograph would eat that, and
 * the failure would not be "the picture did not save" - it would be the next
 * `saveData` throwing with a day's edits in hand, sync dropping, the backup
 * refusing. So the blobs are in IndexedDB in a store of their own, and what
 * the state holds is an id and the two numbers a thumbnail needs before the
 * blob has loaded.
 *
 * **Not in sync, and not in the backup.** See DECISIONS "A photograph stays
 * on the device it was taken on". Sync moves entities as JSON over a small
 * server, and the backup is a file the owner is meant to be able to open and
 * read; a base64 photograph is neither of those things any more. The id
 * travels, the picture does not, and the note on the other device says so in
 * words rather than showing a broken frame.
 *
 * **Best-effort, like snapshots.ts.** IndexedDB can be missing, blocked, or
 * fail mid-transaction, and none of that may stop a note from being written.
 * Every function here degrades to "there is no picture", which is where
 * every note starts anyway.
 */

/** The longer edge, after shrinking. A screenshot is read, not printed. */
export const PHOTO_MAX_EDGE = 1600

/** JPEG quality for the re-encode. High enough that text in a screenshot stays readable. */
export const PHOTO_QUALITY = 0.8

/**
 * The ceiling for one picture, after shrinking. Nothing off a phone camera
 * comes near it once the longer edge is 1600; a wall of a screenshot from a
 * 6K display might, and refusing that with a sentence beats a store that
 * quietly fills up.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/**
 * Twenty in one note. Past that it is not a note with pictures in it, it is
 * an album, and an album is a different thing that this layer has said no to
 * since v1.8 - see CONVENTIONS section 11.
 */
export const MAX_PHOTOS_PER_NOTE = 20

/** What the note holds: an id, and the shape to lay out before the blob loads. */
export interface NotePhoto {
  id: string
  width: number
  height: number
}

/**
 * The blob store, as an interface, so a test can hand it a Map and the
 * browser can hand it IndexedDB. It is also what the real one degrades to
 * when a private window refuses the database: every method answers, and the
 * answers mean "nothing is stored here".
 */
export interface PhotoStore {
  put: (id: string, blob: Blob) => Promise<boolean>
  get: (id: string) => Promise<Blob | null>
  delete: (id: string) => Promise<void>
  keys: () => Promise<string[]>
}

const DB_NAME = 'dienius-photos'
const DB_VERSION = 1
const STORE = 'photos'

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
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
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

/** The real one. Every call opens and closes: a photograph is written once and read rarely. */
export function indexedDbPhotoStore(): PhotoStore {
  return {
    async put(id, blob) {
      const db = await openDb()
      if (!db) return false
      // `put` resolves with the key, so a successful write is a non-null
      // result; a quota refusal errors and `transact` turns that into null.
      const key = await transact<IDBValidKey>(db, 'readwrite', store => store.put(blob, id))
      db.close()
      return key !== null
    },
    async get(id) {
      const db = await openDb()
      if (!db) return null
      const found = await transact<Blob | undefined>(db, 'readonly', store => store.get(id))
      db.close()
      return found instanceof Blob ? found : null
    },
    async delete(id) {
      const db = await openDb()
      if (!db) return
      await transact(db, 'readwrite', store => store.delete(id))
      db.close()
    },
    async keys() {
      const db = await openDb()
      if (!db) return []
      const keys = await transact<IDBValidKey[]>(db, 'readonly', store => store.getAllKeys())
      db.close()
      return (keys ?? []).map(String)
    },
  }
}

/** A Map behind the same interface, for tests and for a browser with no database. */
export function memoryPhotoStore(): PhotoStore {
  const map = new Map<string, Blob>()
  return {
    put: async (id, blob) => {
      map.set(id, blob)
      return true
    },
    get: async id => map.get(id) ?? null,
    delete: async id => {
      map.delete(id)
    },
    keys: async () => [...map.keys()],
  }
}

let store: PhotoStore = indexedDbPhotoStore()

/** Swaps the store. Tests use it; nothing in the app does. */
export function setPhotoStore(next: PhotoStore): void {
  store = next
}

/**
 * The size a picture is scaled to: the longer edge at the limit, the shape
 * kept, and never a zero - a panorama four thousand pixels wide and three
 * tall still has to be one pixel tall to be a picture at all.
 */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/**
 * The picture as it will be stored: the longer edge at `PHOTO_MAX_EDGE`,
 * re-encoded as JPEG. A photograph off a phone is twelve megabytes of
 * detail nobody will look at on a thumbnail, and a screenshot is a picture
 * of text - 1600px keeps the text readable and takes the file to tens of
 * kilobytes.
 *
 * The decode and the canvas are the browser's, so this is the one part of
 * the module a unit test cannot reach; `fitWithin` holds the arithmetic and
 * is tested on its own. When the browser has neither `createImageBitmap`
 * nor a working canvas, the original is kept at its own size rather than
 * refused - a picture that is too big is a better outcome than no picture,
 * and `refusePhoto` still holds the ceiling.
 */
export async function shrinkPhoto(file: Blob): Promise<{ blob: Blob; width: number; height: number } | null> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
    const bitmap = await createImageBitmap(file)
    const size = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0, size.width, size.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY))
    if (!blob) return null
    return { blob, width: size.width, height: size.height }
  } catch {
    return null
  }
}

/**
 * Why this picture is not going in, in words somebody would say, or null if
 * it is. Checked after shrinking, because the size that matters is the size
 * that would be stored - a 12 MB photograph off a phone is an ordinary one
 * and comes out well under a megabyte.
 */
export function refusePhoto(blob: Blob, alreadyOnTheNote: number): string | null {
  if (!blob.type.startsWith('image/')) return 'That is not a picture.'
  if (alreadyOnTheNote >= MAX_PHOTOS_PER_NOTE) return `A note holds ${MAX_PHOTOS_PER_NOTE} pictures. Start another note for the rest.`
  if (blob.size > MAX_PHOTO_BYTES) return 'That picture is still over 5 MB after shrinking. Crop it and try again.'
  return null
}

/**
 * Puts a picture in the store and hands back what the note should hold.
 * Null when the store refused it, which the caller shows as a sentence
 * rather than adding a photograph the note cannot open.
 */
export async function keepPhoto(blob: Blob, width: number, height: number): Promise<NotePhoto | null> {
  const id = crypto.randomUUID()
  const ok = await store.put(id, blob)
  return ok ? { id, width, height } : null
}

/** The blob, or null - which is what a note taken on the other device reads as. */
export function readPhoto(id: string): Promise<Blob | null> {
  return store.get(id)
}

/** Whether this device has the picture, which is what the placeholder asks. */
export async function hasPhoto(id: string): Promise<boolean> {
  return (await store.get(id)) !== null
}

/**
 * Puts a blob back under an id it already had. The one caller is the undo
 * of a note delete, which is holding the pictures it took out a moment ago
 * - see `deleteScratchWithPhotos`. Not `keepPhoto`, because that mints a
 * new id and the note being restored names the old one.
 */
export function restorePhoto(id: string, blob: Blob): Promise<boolean> {
  return store.put(id, blob)
}

/**
 * Deletes pictures by id. Deleting one that is not there is quiet on
 * purpose: a note deleted on two devices sends the same delete twice.
 */
export async function deletePhotos(ids: string[]): Promise<void> {
  for (const id of ids) await store.delete(id)
}

/** Every id the store holds. For the orphan sweep, and for a test. */
export function photoIds(): Promise<string[]> {
  return store.keys()
}
