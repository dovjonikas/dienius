import { commit, getData, replaceState } from './core'
import type { AppData } from '../types'
import { importJson } from '../storage'
import { mergeStates, normaliseRemote } from '../syncMerge'
import { discardTourCreated, keepTourCreated } from '../tour'

/** Whole-state writes: a backup coming in, a snapshot coming back, the tour's two endings. */
export const lifecycleActions = {
  importData(text: string): void {
    commit(importJson(text))
  },

  /**
   * Puts back a whole state - a daily snapshot - as a deliberate edit made
   * now.
   *
   * Through `commit`, which is the entire point of it existing separately
   * from `replaceState`. Two things follow from that and both are required.
   * It is written to storage, so a restore survives closing the tab; it used
   * to go through `resetForTests`, which only ever set the in-memory value,
   * so restoring last Tuesday and then reloading quietly gave you back today.
   * And every entity it changes is stamped now and everything it removes gets
   * a tombstone, so the restore wins the next sync instead of being undone
   * by whichever device still had the newer version - a restore is a decision
   * about what the plan should be, not an old copy arriving late.
   */
  restoreState(next: AppData): void {
    commit(next)
  },

  /**
   * Brings back from a copy - the backup on GitHub - whatever this plan does
   * not have, one entity at a time: what the copy holds a newer version of,
   * and what is missing here without having been deleted here. Nothing newer
   * here is touched, and nothing is stamped, so the next sync treats what
   * came back exactly as old as it is.
   *
   * The first press on a restore since v2.34. `restoreState` - everything
   * replaced, stamped now - is the second, armed one: with sync on it wins
   * on every device, and what was done since the copy is undone there too
   * (docs/SYNC-AUDIT.md, path 5).
   */
  mergeBackup(copy: AppData): void {
    const merged = mergeStates(getData(), normaliseRemote(copy), new Date().toISOString())
    replaceState(merged.data, { owed: true })
  },

  /** The tour's "Start clean": what it made goes, nothing else moves. */
  discardTourCreated(): void {
    const data = getData()
    commit(discardTourCreated(data))
  },

  /** The tour's "Keep what I built": the flags come off and the entities are ordinary from here on. */
  keepTourCreated(): void {
    const data = getData()
    commit(keepTourCreated(data))
  },
}
