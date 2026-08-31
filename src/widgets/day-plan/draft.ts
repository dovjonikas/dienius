const DRAFT_KEY = 'dienius:quick-add-draft'

interface StoredDraft {
  date: string
  text: string
}

function isStoredDraft(x: unknown): x is StoredDraft {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as StoredDraft).date === 'string' &&
    typeof (x as StoredDraft).text === 'string'
  )
}

/**
 * The quick-add input only lives in component state, so a forced reload -
 * the app does this itself when a new deploy takes over mid-session, see
 * src/pwa.ts - would otherwise silently drop whatever someone was in the
 * middle of typing. That is a realistic moment for this app's own use: a
 * background update landing while jotting something down mid-shift.
 *
 * sessionStorage rather than localStorage: a draft is scoped to "this tab
 * right now", not something that should reappear in a future visit or leak
 * into the permanent data export. Saved on every keystroke rather than only
 * right before the reload, so it survives an ordinary accidental refresh or
 * tab close too, not just the service worker's own reload.
 */
export function saveDraft(date: string, text: string): void {
  try {
    if (!text) {
      sessionStorage.removeItem(DRAFT_KEY)
      return
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ date, text }))
  } catch {
    // Best effort - losing the draft here is no worse than not having it.
  }
}

/**
 * Reads and clears the draft in one step ("consume" rather than "read"),
 * so it is only ever offered back once and cannot reappear on some later,
 * unrelated reload. Scoped to the date it was written for: the app always
 * reopens on today after a reload, so a draft typed on another day simply
 * is not restored rather than resurfacing on the wrong day.
 */
export function consumeDraft(date: string): string {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return ''
    sessionStorage.removeItem(DRAFT_KEY)
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredDraft(parsed) || parsed.date !== date) return ''
    return parsed.text
  } catch {
    return ''
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignore
  }
}
