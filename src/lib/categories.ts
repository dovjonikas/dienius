/**
 * What kind of thing a task is, and the one colour that says so everywhere it
 * appears - the block on the timeline and the card in the list, always the
 * same hue, so the eye pairs them without reading either.
 *
 * Six, not more. The point of a colour system here is that a whole day can be
 * taken in without reading it: roughly how much of today is work, whether
 * anything was left for the body, whether meals actually got planned. Past
 * about six hues that stops working - nobody holds twelve colour meanings at
 * once, and a palette that has to be looked up is a legend, not a signal. See
 * docs/RESEARCH-ADHD.md section 7 on how few things can be held at a glance.
 *
 * The colours themselves are fixed hex values rather than theme tokens, the
 * same way `Template.color` already is. A category means the same thing in
 * every one of the eleven presets, and the day would read differently in each
 * one if these followed the theme. They are drawn as a soft wash (about a
 * fifth of the colour, over whatever surface the theme provides) with the full
 * strength kept for a 3px edge, so they stay legible in light and dark without
 * a second set of values, and never compete with the text sitting on them.
 */
export type CategoryId = 'core' | 'routine' | 'health' | 'meal' | 'commute' | 'personal'

export interface Category {
  id: CategoryId
  /** Shown next to the swatch wherever one is offered - colour is never the only signal. */
  label: string
  color: string
}

export const CATEGORIES: Category[] = [
  { id: 'core', label: 'Focus', color: '#7aa2f7' },
  { id: 'routine', label: 'Routine', color: '#9d8bd6' },
  { id: 'health', label: 'Health', color: '#6fbf94' },
  { id: 'meal', label: 'Meals', color: '#dda15e' },
  { id: 'commute', label: 'Commute', color: '#8d939e' },
  { id: 'personal', label: 'Personal', color: '#d489b6' },
]

/**
 * The category a task gets when nothing else says otherwise - what quick-add
 * opens on. Focus rather than a seventh "uncategorised" value: a task typed
 * into a planner in the middle of a working day is far more often work than
 * anything else, and a wrong guess costs one tap to fix, while an
 * uncategorised default would leave most real days grey.
 */
export const DEFAULT_CATEGORY: CategoryId = 'core'

const BY_ID = new Map(CATEGORIES.map(c => [c.id, c]))

export function isCategoryId(x: unknown): x is CategoryId {
  return typeof x === 'string' && BY_ID.has(x as CategoryId)
}

/**
 * Undefined for a task written before this field existed, or one restored from
 * a backup that predates it - every reader treats that exactly as it always
 * did, falling back to the day's own template colour. Nothing is retroactively
 * recoloured on load.
 */
export function findCategory(id: string | undefined): Category | undefined {
  return id === undefined ? undefined : BY_ID.get(id as CategoryId)
}

export function categoryColor(id: string | undefined): string | undefined {
  return findCategory(id)?.color
}

export function categoryLabel(id: string | undefined): string | undefined {
  return findCategory(id)?.label
}
