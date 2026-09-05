import { contrastRatio, mixSrgb } from './contrast'
import { PRESETS } from './themes'
import type { Category } from './types'

/**
 * What kind of thing a task is, and the one colour that says so everywhere it
 * appears - the block on the timeline and the card in the list, always the
 * same hue, so the eye pairs them without reading either.
 *
 * About six, not more. The point of a colour system here is that a whole day
 * can be taken in without reading it: roughly how much of today is work,
 * whether anything was left for the body, whether meals actually got planned.
 * Past about six hues that stops working - nobody holds twelve colour meanings
 * at once, and a palette that has to be looked up is a legend, not a signal.
 * See docs/RESEARCH-ADHD.md section 7 on how few things can be held at a
 * glance.
 *
 * **The app ships six; it does not own them.** Which six was never a decision
 * this app was in a position to make - a planner that will not let somebody
 * rename "Commute" when they work from home is being precious - so the list
 * lives in `AppData` and this module holds only the defaults it starts with
 * and the lookups every reader uses. No cap is enforced. Settings says what
 * the number is for, once, and then gets out of the way.
 *
 * The colour is a CSS custom property rather than a literal for the six
 * defaults, and that is the trick worth keeping. What a category looks like is
 * decided in styles.css, which carries one set of values for dark themes and
 * one for light: a category means the same thing in every theme - somebody
 * switching from Dark to Light is not asking for their day to be re-coded -
 * but how loud a hue has to be to read is completely different on near-black
 * than on white, and only the stylesheet knows which is in force. A colour
 * somebody picked by hand cannot do that, because one hex is one hex, so it is
 * used in both and `CATEGORY_PALETTE` below is chosen to survive both.
 *
 * They are drawn as a soft wash with the full strength kept for a 4px edge, so
 * they stay legible in both without competing with the text sitting on them.
 */

/**
 * A category id is any string, and has been since categories became the
 * owner's to author.
 *
 * It was a closed union of the six ids the app shipped, which the type system
 * could check and `validate` could refuse anything outside. That is not
 * available once a person can make one up: an id from `crypto.randomUUID()`
 * cannot be checked against a list nobody wrote. So a category id joins
 * `templateId`, `libraryRef` and `sleepProfileId` as an id that may dangle,
 * and every reader here already answers a dangling one the same way it answers
 * an absent one - with nothing, which is what "no category" looks like.
 */
export type CategoryId = string

export type { Category }

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
 *
 * These ids are load-bearing. Every task, template block and backlog item on
 * disk points at one of them by name, so they keep the literals they have
 * always had and nothing had to be rewritten when the list moved into the
 * data.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  // Labelled "Deep work" rather than "Focus": Focus is also the name of a
  // running state in this app, with a bar, a button and a keyboard shortcut,
  // and a card that said "Focus" in its meta line while a Focus session ran
  // above it meant two different things at once. The id is untouched - every
  // stored task and every template block holds 'core', and none of them had
  // to change for this.
  { id: 'core', label: 'Deep work' },
  { id: 'routine', label: 'Routine' },
  { id: 'health', label: 'Health' },
  { id: 'meal', label: 'Meals' },
  { id: 'commute', label: 'Commute' },
  { id: 'personal', label: 'Personal' },
]

/** The ids styles.css carries a dark/light `--cat-*` pair for. */
const BUILT_IN_IDS = new Set(DEFAULT_CATEGORIES.map(c => c.id))

/**
 * The category a task gets when nothing else says otherwise - what quick-add
 * opens on. Deep work rather than a seventh "uncategorised" value: a task
 * typed into a planner in the middle of a working day is far more often work
 * than anything else, and a wrong guess costs one tap to fix, while an
 * uncategorised default would leave most real days grey.
 *
 * It is an id rather than a position because it has to survive a reorder. When
 * somebody has deleted it, `defaultCategoryId` below falls back to the first
 * in the list, which is the only other answer that is always there.
 */
export const DEFAULT_CATEGORY: CategoryId = 'core'

export function defaultCategoryId(categories: Category[]): CategoryId {
  return categories.some(c => c.id === DEFAULT_CATEGORY) ? DEFAULT_CATEGORY : (categories[0]?.id ?? DEFAULT_CATEGORY)
}

/**
 * Undefined for a task written before this field existed, one restored from a
 * backup that predates it, or one pointing at a category that has since been
 * deleted on another device. Every reader treats all three exactly the same
 * way, falling back to the day's own template colour. Nothing is retroactively
 * recoloured on load.
 */
export function findCategory(id: string | undefined, categories: Category[]): Category | undefined {
  return id === undefined ? undefined : categories.find(c => c.id === id)
}

/**
 * What to assign to a `--cat` custom property.
 *
 * A `var(--cat-*)` reference for one of the six the app ships, so the
 * stylesheet's dark and light pair still decides; the literal hex somebody
 * picked otherwise. Both resolve exactly where the other would - a reference
 * is one cascade step later and takes the current theme into account, a
 * literal is the colour that was chosen, in both themes, which is what
 * picking a colour means.
 */
export function categoryColor(id: string | undefined, categories: Category[]): string | undefined {
  const category = findCategory(id, categories)
  if (!category) return undefined
  return resolvedColor(category)
}

export function resolvedColor(category: Category): string {
  return category.color ?? `var(--cat-${category.id})`
}

/** Whether this category still has a built-in dark/light pair to fall back to. */
export function hasBuiltInColor(id: string): boolean {
  return BUILT_IN_IDS.has(id)
}

export function categoryLabel(id: string | undefined, categories: Category[]): string | undefined {
  return findCategory(id, categories)?.label
}

/**
 * The twelve colours offered when somebody picks one by hand.
 *
 * Curated rather than borrowed from `PALETTE_COLORS`, which templates and
 * if-then tags draw from, because those are pastels chosen to sit behind a
 * name as decoration and a category colour has a harder job: it is the 4px
 * edge of a card, the wash under a title on the timeline, and the dot in a
 * swatch row - and unlike the six the app ships, one hex has to do all of that
 * on near-black *and* on white. So these sit in the middle of the luminance
 * range where both are possible, at twelve hues spread evenly enough that two
 * adjacent choices are still telling apart at a glance.
 *
 * Every one of them is checked by `categories.test.ts` against the same rule
 * `isCategoryColorReadable` applies to a hand-typed hex, in every theme the
 * app ships. A palette entry that fails is not mergeable, for the same reason
 * a preset that fails `theme-contrast.test.ts` is not.
 *
 * Grey is not on it, and cannot be: finished work drains to grey to show a day
 * going quiet, so a grey category would read as already behind you. Same
 * reason Commute is teal - see the note on DEFAULT_CATEGORIES.
 */
export const CATEGORY_PALETTE: { value: string; name: string }[] = [
  { value: '#5b8ae6', name: 'Blue' },
  { value: '#7b7fe0', name: 'Indigo' },
  { value: '#9b7bd8', name: 'Violet' },
  { value: '#c072c0', name: 'Magenta' },
  { value: '#d1698f', name: 'Rose' },
  { value: '#d9705f', name: 'Red' },
  { value: '#bd7f30', name: 'Amber' },
  { value: '#8a9439', name: 'Olive' },
  { value: '#4fa46a', name: 'Green' },
  { value: '#3aa588', name: 'Emerald' },
  { value: '#3f9fae', name: 'Teal' },
  { value: '#a0785c', name: 'Brown' },
]

export function categoryColorName(hex: string): string {
  return CATEGORY_PALETTE.find(c => c.value.toLowerCase() === hex.toLowerCase())?.name ?? hex
}

/** `#rgb` or `#rrggbb`, which is what `<input type="color">` and a person both produce. */
export const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

/**
 * The wash a category colour is actually read against, at its strongest end.
 *
 * `.timeline-anchor-cat` runs 30% of the colour at the left edge down to 15%
 * across the block, and the title sitting on it is not `--text` but a 22% mix
 * toward the colour. So the honest thing to check is that mixed title against
 * the 30% end - not the colour against the surface, which is a pair nothing
 * ever paints next to each other.
 */
const WASH_STRENGTH = 0.3
const TITLE_MIX = 0.22

/** Body text, the same bar `theme-contrast.test.ts` holds every preset to. */
export const MIN_CATEGORY_CONTRAST = 4.5

export function categoryContrast(hex: string, surface: string, text: string): number {
  return contrastRatio(mixSrgb(hex, text, TITLE_MIX), mixSrgb(hex, surface, WASH_STRENGTH))
}

/**
 * Every ground a category colour can be painted on: the card surface of every
 * mode of every preset the app ships, paired with the ink that mode uses.
 *
 * Derived from `PRESETS` rather than listed, so a fourth theme is covered the
 * day it lands rather than the day somebody remembers this exists.
 */
export function themeGrounds(): { name: string; surface: string; text: string }[] {
  const out: { name: string; surface: string; text: string }[] = []
  for (const preset of PRESETS) {
    for (const mode of preset.modes) {
      const variant = mode === 'light' ? preset.light : preset.dark
      if (!variant) continue
      out.push({ name: `${preset.name} (${mode})`, surface: variant.tokens.surface, text: variant.tokens.text })
    }
  }
  return out
}

/**
 * Whether a hand-picked colour will still be readable once the app paints it.
 *
 * Refuses rather than clamps. Silently changing what somebody picked is worse
 * than saying it will not read: a clamped colour is a third thing that is
 * neither what they chose nor what the app would have chosen, and they would
 * have no way to tell it happened.
 *
 * Checked in every theme, not the one currently painting, because one hex now
 * serves both where the built-in pair served each separately - a colour that
 * only works in Dark is a colour that breaks the day somebody switches.
 */
export function isCategoryColorReadable(hex: string): boolean {
  if (!HEX_COLOR.test(hex)) return false
  return themeGrounds().every(g => categoryContrast(hex, g.surface, g.text) >= MIN_CATEGORY_CONTRAST)
}
