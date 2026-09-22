import { clearSnapshots } from './snapshots'

/**
 * Everything this device holds, gone.
 *
 * "Erase all data" is pressed for two reasons - starting again, and handing
 * the machine on - and both mean every key this app wrote here, not only the
 * plan: the sync switch and what this device knows about its own syncing,
 * the repo and the token Backup uses, the timer, the cached calendars, the
 * demo's own copy, the tour's, and the small remembered things beside them.
 *
 * It was the plan's key, the timer, the snapshots and the calendar cache -
 * and sync was left switched on, so the plan came straight back from GitHub
 * a second after the erase and the screen flickered from "nothing here" to
 * the day it was supposed to have forgotten. An erase that undoes itself is
 * not an erase, and a token left behind on a machine somebody is giving away
 * is worse.
 *
 * **What is on GitHub stays.** This is a device, not an account: the other
 * device's plan, the shared copy and the backup are none of this button's
 * business. Setting the repo and the token again brings the plan back, which
 * is exactly how a new device joins.
 *
 * Every key this app writes starts `dienius:` - see the modules that own
 * them - so this takes the prefix rather than a list to keep up to date.
 */
export function eraseThisDevice(): void {
  forget(typeof localStorage === 'undefined' ? undefined : localStorage)
  forget(typeof sessionStorage === 'undefined' ? undefined : sessionStorage)
  // The daily snapshots live in IndexedDB, under their own database. A copy
  // of everything left behind by "remove everything on this device" would be
  // the most surprising leftover of the lot. Not awaited: the reload that
  // follows is the point, and a delete that has not finished by then
  // finishes without anybody watching.
  void clearSnapshots()
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
