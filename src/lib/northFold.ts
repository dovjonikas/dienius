const FOLD_KEY = 'dienius:north-fold'

/** North's headings on the day: open, or folded away under the word North. */
export type NorthFold = 'open' | 'folded'

/**
 * Whether North's headings are folded on the day, as this device last left
 * them, or null when nobody has chosen here.
 *
 * A device fact, under its own key and so outside the backup and outside
 * sync - the same reasoning as the library's open lists (libraryPrefs.ts).
 * The rail of a wide window and the line under a phone's day are one
 * section, folded or not, and what was chosen on one screen says nothing
 * about another device. Null leaves the layout its own default: open in the
 * rail when the rail has room, folded on a phone.
 */
export function readNorthFold(): NorthFold | null {
  try {
    const value = localStorage.getItem(FOLD_KEY)
    return value === 'open' || value === 'folded' ? value : null
  } catch {
    return null
  }
}

export function rememberNorthFold(fold: NorthFold): void {
  try {
    localStorage.setItem(FOLD_KEY, fold)
  } catch {
    // Best effort: a device that cannot remember starts from the default.
  }
}
