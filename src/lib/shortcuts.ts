/**
 * The keyboard layer.
 *
 * Two rules decide everything here, and they are the reason a single-letter
 * shortcut is safe at all in an app whose main gesture is typing a task:
 *
 * 1. A bare letter never fires while a field has focus. Every one of these is
 *    a plain key with no modifier, which is what makes them fast and what
 *    makes them dangerous - "n" while the quick-add box is focused has to
 *    type an n, always.
 * 2. Escape always fires, field or not, because it is the one key that means
 *    "get me out of this" and the thing somebody wants out of is usually the
 *    field itself.
 *
 * The list is deliberately short. A shortcut nobody can name is a shortcut
 * nobody uses, and this fits on one card - which is exactly what "?" shows.
 */

export interface Shortcut {
  /** The key as `KeyboardEvent.key` reports it, already lowercased. */
  key: string
  /** What it is called on the card. */
  label: string
  description: string
}

export const SHORTCUTS: Shortcut[] = [
  { key: 'n', label: 'N', description: 'Add a task - jumps to the box and starts typing' },
  { key: 't', label: 'T', description: 'Back to today' },
  { key: 'arrowleft', label: '←', description: 'The day before' },
  { key: 'arrowright', label: '→', description: 'The day after' },
  { key: '1', label: '1', description: 'Today' },
  { key: '2', label: '2', description: 'Calendar' },
  { key: '3', label: '3', description: 'Templates' },
  { key: '4', label: '4', description: 'Library' },
  { key: '5', label: '5', description: 'Review' },
  { key: '6', label: '6', description: 'Settings' },
  { key: 'f', label: 'F', description: 'Start Focus on the task that is running now' },
  { key: 'escape', label: 'Esc', description: 'Close whatever is open' },
  { key: '?', label: '?', description: 'This list' },
]

/**
 * Whether a key event is somebody typing rather than reaching for a command.
 *
 * `isContentEditable` catches a rich-text host if one ever appears; the rest
 * is the three real field elements plus anything a component has explicitly
 * marked with `data-keeps-keys`, which is the escape hatch for a widget that
 * handles its own keys (the time picker's own arrow stepping, say) without
 * having to be a field.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest('[data-keeps-keys]')) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * The key a bare-key shortcut should act on, or null when this event is not
 * one - because something is typing, because a modifier is held (that is the
 * browser's or the OS's chord, never ours), or because it repeated.
 *
 * Escape is the exception on both counts: it passes through a focused field,
 * since getting out of the field is usually the point.
 */
export function shortcutKeyFor(e: KeyboardEvent): string | null {
  if (e.altKey || e.ctrlKey || e.metaKey) return null
  const key = e.key.toLowerCase()
  if (key === 'escape') return 'escape'
  if (e.repeat) return null
  if (isTypingTarget(e.target)) return null
  // Shift is allowed only for "?", which is a shifted key on most layouts.
  if (e.shiftKey && key !== '?') return null
  return key
}
