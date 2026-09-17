import { calendarActions } from './store/calendars'
import { categoryActions } from './store/categories'
import { dayActions } from './store/days'
import { kitchenActions } from './store/kitchen'
import { laterActions } from './store/later'
import { libraryActions } from './store/library'
import { lifecycleActions } from './store/lifecycle'
import { northActions } from './store/north'
import { scratchActions } from './store/scratch'
import { settingsActions } from './store/settings'
import { shiftActions } from './store/shifts'
import { templateActions } from './store/templates'
import { resetForTests } from './store/core'

export { MAX_PUSHES } from './pushRules'
export { getData, getSaveOk, onStateCommitted, replaceState, subscribe, useAppData } from './store/core'
export type { RolloverResult } from './store/days'

/**
 * The store, as everything outside `store/` sees it: one `actions` object
 * and the handful of reads and subscriptions beside it.
 *
 * It was one 1600-line file until v1.10, a flat list of ninety-odd actions
 * that read fine and grew by a dozen every wave. It is twelve files now, one
 * per area of the data - the day, the library, templates, North, Later,
 * scratch, calendars, settings, categories, Kitchen, rotating shifts, and the
 * whole-state writes - each importing the same two things from `store/core.ts`: the
 * state through `getData()`, and the one way to change it, `commit()`.
 *
 * This file is the seam that made the split invisible: every import of
 * `actions` in the app and the tests is unchanged, and the spread below is
 * the whole of what it does. An action name that appears in two areas would
 * be a bug the spread hides, so `store.test.ts` checks the twelve objects for
 * overlap. Goals and their rules had two areas of their own until v2.28 -
 * see DECISIONS "North is one text, goals retired".
 */
export const actions = {
  ...dayActions,
  ...libraryActions,
  ...templateActions,
  ...northActions,
  ...laterActions,
  ...scratchActions,
  ...calendarActions,
  ...settingsActions,
  ...categoryActions,
  ...kitchenActions,
  ...shiftActions,
  ...lifecycleActions,
  resetForTests,
}

/** The twelve areas, exported so the overlap check can see them one at a time. */
export const AREAS = {
  dayActions,
  libraryActions,
  templateActions,
  northActions,
  laterActions,
  scratchActions,
  calendarActions,
  settingsActions,
  categoryActions,
  kitchenActions,
  shiftActions,
  lifecycleActions,
}
