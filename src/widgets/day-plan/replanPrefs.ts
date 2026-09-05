import { DEFAULT_TITLE } from './interrupt'

const TITLES_KEY = 'dienius:replan-titles'

/** How many names the sheet keeps as chips. Three is a row on a phone; the fourth is typed. */
export const RECENT_TITLES_MAX = 3

/**
 * The last few names given to an interruption, most recent first.
 *
 * The people and things that break a day are the same people and things:
 * dad, the school, the dentist. Three chips of them put the name one tap
 * away, and the name is optional anyway - "Something came up" stands in.
 *
 * Its own key rather than a field in `Settings`, so deliberately outside the
 * backup and outside sync - the same reasoning as quick-add's remembered
 * length and the rest of ARCHITECTURE section 2. It is a device's habit,
 * not a plan: restoring a snapshot has no business changing which names are
 * offered, and a phone and a laptop are allowed to remember different ones.
 * The stand-in title is never remembered; a chip that says what the
 * placeholder already says is a chip that does nothing.
 */
export function readRecentTitles(): string[] {
  try {
    const raw = localStorage.getItem(TITLES_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Anything that is not a short plain string is somebody else's write,
    // and the honest response to a value this cannot read is no chips.
    return parsed.filter((t): t is string => typeof t === 'string' && t.trim().length > 0 && t.length <= 80).slice(0, RECENT_TITLES_MAX)
  } catch {
    return []
  }
}

export function rememberTitle(title: string): void {
  const trimmed = title.trim()
  if (trimmed === '' || trimmed === DEFAULT_TITLE) return
  const rest = readRecentTitles().filter(t => t.toLowerCase() !== trimmed.toLowerCase())
  try {
    localStorage.setItem(TITLES_KEY, JSON.stringify([trimmed, ...rest].slice(0, RECENT_TITLES_MAX)))
  } catch {
    // Best effort, like every other device habit: a forgotten name is one
    // more word typed next time, not a lost plan.
  }
}

/** Test seam. */
export function forgetRecentTitles(): void {
  try {
    localStorage.removeItem(TITLES_KEY)
  } catch {
    // Nothing to forget.
  }
}
