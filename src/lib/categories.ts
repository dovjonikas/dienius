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
 * The colour itself is a CSS custom property, not a literal, and that is the
 * whole trick. Which categories exist and what they are called is decided
 * here; what they look like is decided in styles.css, which carries one set of
 * values for dark themes and one for light. A category means the same thing in
 * every theme - somebody switching from Dark to Light is not asking for their
 * day to be re-coded - but how loud a hue has to be to read is completely
 * different on near-black than on white, and only the stylesheet knows which
 * is in force. Nothing in this module, and nothing that calls it, has to.
 *
 * They are drawn as a soft wash with the full strength kept for a 4px edge, so
 * they stay legible in both without competing with the text sitting on them.
 */
export type CategoryId = 'core' | 'routine' | 'health' | 'meal' | 'commute' | 'personal'

export interface Category {
  id: CategoryId
  /** Shown next to the swatch wherever one is offered - colour is never the only signal. */
  label: string
  /**
   * A `var(--cat-*)` reference, not a hex value - see the note above. Every
   * call site assigns it straight to a `--cat` custom property, so a
   * reference resolves exactly where a literal used to, one cascade step
   * later and with the current theme taken into account.
   */
  color: string
}

/**
 * Six hues, spread as far apart as six can be while all staying quiet. The
 * actual values live in styles.css, twice - once for dark, once for light.
 *
 * Commute is the one that is not what it first looks like it should be. The
 * obvious colour for travel is a neutral grey, and it was one - until finished
 * work started draining to grey to show a day going quiet. Once grey means
 * "done", nothing else in the system is allowed to be grey, or every commute
 * on the grid reads as already behind you. Teal is the least saturated hue
 * left that is unmistakably a hue, which keeps the intent (this is the plain,
 * unremarkable part of the day) without borrowing a meaning that is taken.
 */
export const CATEGORIES: Category[] = [
  { id: 'core', label: 'Focus', color: 'var(--cat-core)' },
  { id: 'routine', label: 'Routine', color: 'var(--cat-routine)' },
  { id: 'health', label: 'Health', color: 'var(--cat-health)' },
  { id: 'meal', label: 'Meals', color: 'var(--cat-meal)' },
  { id: 'commute', label: 'Commute', color: 'var(--cat-commute)' },
  { id: 'personal', label: 'Personal', color: 'var(--cat-personal)' },
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
