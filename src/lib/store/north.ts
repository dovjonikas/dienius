import { commit, getData } from './core'
import type { Settings } from '../types'
import { withPicture } from '../north'

/** North: its one text and its switches. Nothing here measures anything - see lib/north.ts. */
export const northActions = {
  /**
   * The text, written or rewritten. Empty removes it - see `withPicture`
   * for why removed and not blank.
   */
  setPicture(text: string): void {
    commit(withPicture(getData(), text))
  },

  setNorthSettings(north: Settings['north']): void {
    const data = getData()
    commit({ ...data, settings: { ...data.settings, north } })
  },
}
