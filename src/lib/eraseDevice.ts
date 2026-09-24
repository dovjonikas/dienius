/**
 * Everything this device holds, gone.
 *
 * "Erase all data" is pressed for two reasons - starting again, and handing
 * the machine on - and both mean everything this app wrote here, not only the
 * plan: the sync switch and what this device knows about its own syncing,
 * the repo and the token Backup uses, the timer, the cached calendars, the
 * demo's own copy, the tour's, the small remembered things beside them, and
 * the three databases - the daily snapshots, the photographs in the notes and
 * the files picked for the Library.
 *
 * It was the plan's key, the timer, the snapshots and the calendar cache -
 * and sync was left switched on, so the plan came straight back from GitHub
 * a second after the erase and the screen flickered from "nothing here" to
 * the day it was supposed to have forgotten. An erase that undoes itself is
 * not an erase, and a token left behind on a machine somebody is giving away
 * is worse. So were the photographs, until the freeze: a note's pictures
 * stayed in their database after the note had gone.
 *
 * **What is on GitHub stays.** This is a device, not an account: the other
 * device's plan, the shared copy and the backup are none of this button's
 * business. Setting the repo and the token again brings the plan back, which
 * is exactly how a new device joins.
 *
 * Every key this app writes starts `dienius:` - see the modules that own
 * them - so this takes the prefix rather than a list to keep up to date.
 * The databases are a list, and a test holds it to every database the code
 * opens.
 *
 * The databases go first and the keys last, and the caller reloads the page
 * as soon as this resolves: nothing gets the chance to write a key back
 * between the two.
 */
export async function eraseThisDevice(
  databases: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
): Promise<void> {
  await Promise.all(DATABASES.map(name => deleteDatabase(databases, name)))
  forget(typeof localStorage === 'undefined' ? undefined : localStorage)
  forget(typeof sessionStorage === 'undefined' ? undefined : sessionStorage)
}

/** Every IndexedDB database this app opens: lib/snapshots.ts, lib/photos.ts and lib/localFile.ts. */
export const DATABASES = ['dienius-snapshots', 'dienius-photos', 'dienius-files'] as const

/**
 * How long an erase waits for a database that does not answer. A delete
 * takes a few milliseconds; one that has not come back by then is held by
 * something this page cannot close, and the person who pressed Erase is not
 * kept waiting for it.
 */
export const DATABASE_WAIT_MS = 2000

function deleteDatabase(databases: IDBFactory | undefined, name: string): Promise<void> {
  return new Promise(resolve => {
    if (!databases) {
      resolve()
      return
    }
    const giveUp = setTimeout(resolve, DATABASE_WAIT_MS)
    const done = () => {
      clearTimeout(giveUp)
      resolve()
    }
    try {
      const request = databases.deleteDatabase(name)
      request.onsuccess = done
      request.onerror = done
    } catch {
      done()
    }
  })
}

function forget(store: Storage | undefined): void {
  if (!store) return
  try {
    const keys: string[] = []
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i)
      if (key !== null && key.startsWith('dienius:')) keys.push(key)
    }
    for (const key of keys) store.removeItem(key)
  } catch {
    // Storage that refuses to be read is storage with nothing to forget.
  }
}
