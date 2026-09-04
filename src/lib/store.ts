import { backlogActions } from './store/backlog'
import { calendarActions } from './store/calendars'
import { dayActions } from './store/days'
import { goalActions } from './store/goals'
import { ifThenActions } from './store/ifThen'
import { libraryActions } from './store/library'
import { lifecycleActions } from './store/lifecycle'
import { scratchActions } from './store/scratch'
import { settingsActions } from './store/settings'
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
 * that read fine and grew by a dozen every wave. It is ten files now, one per
 * area of the data - the day, the library, templates, goals, the two undated
 * shelves, scratch, calendars, settings, if-then rules, and the whole-state
 * writes - each importing the same two things from `store/core.ts`: the
 * state through `getData()`, and the one way to change it, `commit()`.
 *
 * This file is the seam that made the split invisible: every import of
 * `actions` in the app and the tests is unchanged, and the spread below is
 * the whole of what it does. An action name that appears in two areas would
 * be a bug the spread hides, so `store.test.ts` checks the ten objects for
 * overlap.
 */
export const actions = {
  ...dayActions,
  ...libraryActions,
  ...templateActions,
  ...goalActions,
  ...backlogActions,
  ...scratchActions,
  ...calendarActions,
  ...settingsActions,
  ...ifThenActions,
  ...lifecycleActions,
  resetForTests,
}

/** The ten areas, exported so the overlap check can see them one at a time. */
export const AREAS = {
  dayActions,
  libraryActions,
  templateActions,
  goalActions,
  backlogActions,
  scratchActions,
  calendarActions,
  settingsActions,
  ifThenActions,
  lifecycleActions,
}
