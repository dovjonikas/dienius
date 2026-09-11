/**
 * A file on this computer, opened from the app, without a server and without
 * a copy.
 *
 * The owner had a PDF on their disk and put `file://` into a link field. It
 * did nothing, and `linkRefusal` in `link.ts` now says why: a page cannot
 * open a file on the reader's own disk, at any price, in any browser. What
 * that refusal could not do was give them the thing they actually wanted,
 * which was not a link at all - it was "let me point at the file once and
 * then press it".
 *
 * That is what the file picker does. `showOpenFilePicker` hands back a
 * **handle**, not a copy, and a handle survives in IndexedDB across reloads
 * and restarts: the file stays exactly where it is on disk, the app keeps a
 * reference to it, and pressing the link reads it from there. Checked rather
 * than remembered - a handle stored, a reload, and the file's contents read
 * back out of it afterwards.
 *
 * **It stays on the device it was picked on.** Exactly like a photograph in
 * a note (see `photos.ts` and DECISIONS "A photograph stays on the device it
 * was taken on"), and for a harder reason: a handle is a reference to one
 * disk. Carrying it anywhere else would carry a promise the other machine
 * cannot keep. So the handle lives in IndexedDB on this device, what travels
 * in sync and in the backup is the id and the file's name, and the other
 * device says in words which file it means and where it is.
 *
 * **And only where the browser has it.** Chrome and Edge on a desktop have
 * the picker. Safari does not, and Firefox does not, which means an iPhone
 * does not - so the button is absent there rather than broken, and the
 * `linkRefusal` sentence about serving a folder at an address is still the
 * answer for anybody who needs the same book on two machines.
 *
 * **Best-effort throughout, like snapshots.ts and photos.ts.** IndexedDB can
 * be missing or blocked, a handle can outlive the file it points at, and
 * permission can be refused. Every one of those ends in a sentence rather
 * than in a thrown error, because none of them is a reason a library item
 * cannot be read.
 */

/**
 * The picker and the permission calls, which TypeScript's DOM library does
 * not carry: the File System Access API is not in every browser, so it is not
 * in the shared lib. Declared to exactly what this file uses and no wider - a
 * fuller shim would be claiming things nobody here has checked.
 */
declare global {
  interface Window {
    showOpenFilePicker?: (options?: { multiple?: boolean }) => Promise<FileSystemFileHandle[]>
  }
  interface FileSystemFileHandle {
    queryPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
    requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  }
}

/** The scheme this app owns. Not a real URL scheme, and never typed by hand. */
const ON_DEVICE = 'ondevice:'

/** What the item stores: which handle, and what the file was called. */
export interface OnDeviceFile {
  id: string
  name: string
}

/**
 * The string that goes in `link`, which is the field the app already carries
 * to every place a door is drawn - the library row, the task card, Up next
 * and the focus screen. A second field would have had to be taught to all
 * four, plus the validator, the backup and sync; a link is what this is.
 *
 * The name rides along inside it so a device without the handle can say
 * which file is meant instead of showing an id.
 */
export function onDeviceLink(file: OnDeviceFile): string {
  return `${ON_DEVICE}${file.id}/${encodeURIComponent(file.name)}`
}

/** The other direction. `undefined` for anything that is an ordinary address. */
export function onDeviceFile(link: string): OnDeviceFile | undefined {
  if (!link.startsWith(ON_DEVICE)) return undefined
  const rest = link.slice(ON_DEVICE.length)
  const cut = rest.indexOf('/')
  if (cut <= 0) return undefined
  try {
    return { id: rest.slice(0, cut), name: decodeURIComponent(rest.slice(cut + 1)) }
  } catch {
    // A name that is not valid percent-encoding is still a file somebody
    // pointed at. The id is the part that has to be right.
    return { id: rest.slice(0, cut), name: rest.slice(cut + 1) }
  }
}

/** Whether this browser can pick a file at all. False on every iPhone. */
export function canPickFile(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window
}

/**
 * The handle store, as an interface, so a test can hand it a Map and the
 * browser can hand it IndexedDB - the same shape `PhotoStore` uses, and the
 * same degradation: every method answers, and the answers mean "there is
 * nothing here".
 */
export interface HandleStore {
  put: (id: string, handle: FileSystemFileHandle) => Promise<boolean>
  get: (id: string) => Promise<FileSystemFileHandle | null>
  delete: (id: string) => Promise<void>
}

const DB_NAME = 'dienius-files'
const DB_VERSION = 1
const STORE = 'handles'

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

/**
 * A Map, for tests and for anywhere IndexedDB is not. It is honest about
 * what it is: a handle kept here is forgotten when the tab closes, which is
 * the same thing that happens to a handle that was never kept.
 */
export function memoryHandleStore(): HandleStore {
  const kept = new Map<string, FileSystemFileHandle>()
  return {
    put: async (id, handle) => (kept.set(id, handle), true),
    get: async id => kept.get(id) ?? null,
    delete: async id => void kept.delete(id),
  }
}

/** The real one. Opens and closes per call: a handle is written once and read on a press. */
export function indexedDbHandleStore(): HandleStore {
  return {
    async put(id, handle) {
      const db = await openDb()
      if (!db) return false
      const key = await transact<IDBValidKey>(db, 'readwrite', store => store.put(handle, id))
      db.close()
      return key !== null
    },
    async get(id) {
      const db = await openDb()
      if (!db) return null
      const found = await transact<FileSystemFileHandle | undefined>(db, 'readonly', store => store.get(id))
      db.close()
      // A handle from another origin's database, or a value put there by an
      // older version of this app, is not one: it has to answer getFile.
      return found && typeof found.getFile === 'function' ? found : null
    },
    async delete(id) {
      const db = await openDb()
      if (!db) return
      await transact(db, 'readwrite', store => store.delete(id))
      db.close()
    },
  }
}

/**
 * What happened when the file was asked for. Each of these is a sentence the
 * owner reads, and they are different sentences: a file that has moved is
 * not a file this device never had, and neither is permission being refused.
 */
export type OpenResult = 'opened' | 'elsewhere' | 'denied' | 'gone'

/**
 * Ask for the file and open it.
 *
 * The blank tab is opened **before** anything is awaited. A browser lets a
 * page open a tab because a person just pressed something, and that
 * permission does not survive an await in every browser - so the tab is
 * taken while the press is still in hand and pointed at the file once it is
 * ready, or closed again if it is not.
 */
export async function openOnDevice(store: HandleStore, id: string): Promise<OpenResult> {
  // No `noopener`, deliberately, and it is not the oversight it looks like:
  // window.open returns **null** when it is passed, and the reference is the
  // whole point of taking the tab early. It costs nothing here either. The
  // anchor in LinkOut needs noopener because it goes to somebody else's
  // site; this tab holds a blob this app made, which is this app's own
  // origin, so the opener it can reach back to is the page that opened it.
  const tab = typeof window === 'undefined' ? null : window.open('', '_blank')
  const fail = (why: OpenResult): OpenResult => {
    tab?.close()
    return why
  }

  const handle = await store.get(id)
  // No handle here means this is not the computer the file was picked on.
  if (!handle) return fail('elsewhere')

  try {
    // Granted already on most presses after the first: Chrome remembers for
    // an installed app, and asks again in an ordinary tab.
    const mode = { mode: 'read' } as const
    const state = (await handle.queryPermission?.(mode)) ?? 'granted'
    if (state !== 'granted' && (await handle.requestPermission?.(mode)) !== 'granted') return fail('denied')

    // The file itself. This throws when the file has been moved, renamed or
    // deleted since it was picked, which is the one failure the owner can
    // actually do something about.
    const file = await handle.getFile()
    const url = URL.createObjectURL(file)
    if (tab) tab.location.href = url
    // Long enough for the tab to have taken it. Revoking is not optional:
    // the blob is the whole file held in memory until the URL is let go.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return tab ? 'opened' : 'gone'
  } catch {
    return fail('gone')
  }
}

/**
 * Point at a file, and keep the handle.
 *
 * `null` for a cancelled picker, which is not an error and is not worth a
 * sentence - somebody opened the dialog and changed their mind.
 */
export async function pickFile(store: HandleStore, id: string): Promise<OnDeviceFile | null> {
  const picker = typeof window === 'undefined' ? undefined : window.showOpenFilePicker
  if (!picker) return null
  try {
    const [handle] = await picker.call(window, { multiple: false })
    if (!handle) return null
    const kept = await store.put(id, handle)
    // The store refusing is the one case worth refusing the whole thing: an
    // item pointing at a handle nobody kept is a door onto nothing, which is
    // the thing linkRefusal exists to avoid.
    if (!kept) return null
    return { id, name: handle.name }
  } catch {
    // The picker throws AbortError when it is dismissed. Nothing else it
    // throws is worth a different answer here.
    return null
  }
}
