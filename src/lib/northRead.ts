import { isDemoMode } from './demoMode'

const READ_KEY = 'dienius:north-read'

/**
 * The day North was last read on this device, and the rule that opens the
 * app on it in the morning.
 *
 * The one thing the owner asked of North is to see it every morning. A page
 * one press away is a page seen when somebody remembers to press, which on
 * the mornings it is for is never; so the first open of the app on a new day
 * opens on North, with the day itself one press further on. Every later
 * open that day goes to the day as always.
 *
 * A device fact, under its own key and outside the plan - the same reasoning
 * as the library's open lists and the rail's pin. Reading it on the phone at
 * seven does not mean the computer has shown it at nine, and it must not:
 * each screen the owner meets that day meets them with it once. Written to
 * the plan it would also be a commit a day in a synced repo, for nothing.
 *
 * Never in the demo: a stranger opening the sample fortnight should meet
 * the day, and the demo's own text is nobody's morning. And only when there
 * is a text - an empty North is an editor, not a morning.
 */
export function northReadOn(): string | null {
  try {
    return localStorage.getItem(READ_KEY)
  } catch {
    return null
  }
}

export function rememberNorthRead(date: string): void {
  try {
    localStorage.setItem(READ_KEY, date)
  } catch {
    // Nothing to do: the page shows again next open, which is the safe side.
  }
}

/** Whether this open of the app is the day's first look at North. */
export function isNorthMorning(text: string | undefined, today: string): boolean {
  if (isDemoMode() || !text) return false
  return northReadOn() !== today
}
