import { expect, test } from 'vitest'
import {
  CATEGORY_PALETTE,
  DEFAULT_CATEGORIES,
  MIN_CATEGORY_CONTRAST,
  categoryColor,
  categoryColorName,
  categoryContrast,
  categoryLabel,
  defaultCategoryId,
  findCategory,
  hasBuiltInColor,
  isCategoryColorReadable,
  resolvedColor,
  themeGrounds,
} from './categories'
import type { Category } from './types'

/**
 * The lookups, now that the list is the owner's rather than the module's.
 *
 * The one contract worth holding here is what a *dangling* id does. It was
 * impossible before - the id was a closed union, and validate refused
 * anything outside it - and it is now the ordinary consequence of deleting a
 * category on another device before this one has synced. It has to answer
 * exactly the way an absent id answers, which is with nothing, because that
 * is what every reader in the app is already written to handle.
 */

const LIST: Category[] = [
  { id: 'core', label: 'Deep work' },
  { id: 'health', label: 'Health' },
  { id: 'made-up', label: 'Gym', color: '#4fa46a' },
]

test('a built-in category resolves to its stylesheet pair, not to a literal', () => {
  expect(categoryColor('core', LIST)).toBe('var(--cat-core)')
  expect(categoryLabel('core', LIST)).toBe('Deep work')
})

test('a category the owner made resolves to the colour they picked', () => {
  expect(categoryColor('made-up', LIST)).toBe('#4fa46a')
  expect(categoryLabel('made-up', LIST)).toBe('Gym')
})

test('an id that is in no list resolves to nothing, exactly as an absent one does', () => {
  expect(findCategory('deleted-elsewhere', LIST)).toBeUndefined()
  expect(categoryColor('deleted-elsewhere', LIST)).toBeUndefined()
  expect(categoryLabel('deleted-elsewhere', LIST)).toBeUndefined()
  expect(categoryColor(undefined, LIST)).toBeUndefined()
})

test('a recoloured default carries its literal rather than the pair behind it', () => {
  const recoloured: Category[] = [{ id: 'core', label: 'Deep work', color: '#d1698f' }]
  expect(categoryColor('core', recoloured)).toBe('#d1698f')
  // The pair is still there to come back to, which is what the editor's
  // "the app's own colour" needs to be true.
  expect(hasBuiltInColor('core')).toBe(true)
  expect(hasBuiltInColor('made-up')).toBe(false)
})

test('quick-add opens on the shipped default, and on the first in the list once that is gone', () => {
  expect(defaultCategoryId(DEFAULT_CATEGORIES)).toBe('core')
  expect(defaultCategoryId([{ id: 'health', label: 'Health' }, { id: 'meal', label: 'Meals' }])).toBe('health')
  // Nothing left at all should still hand back a string rather than undefined:
  // the caller is a useState initialiser, not a branch.
  expect(typeof defaultCategoryId([])).toBe('string')
})

test('the six the app ships keep the ids every stored task already points at', () => {
  expect(DEFAULT_CATEGORIES.map(c => c.id)).toEqual(['core', 'routine', 'health', 'meal', 'commute', 'personal'])
  // None of them carries a literal: that is what keeps a category meaning the
  // same thing in Dark and Light without anybody choosing twice.
  expect(DEFAULT_CATEGORIES.every(c => c.color === undefined)).toBe(true)
  expect(DEFAULT_CATEGORIES.every(c => resolvedColor(c).startsWith('var(--cat-'))).toBe(true)
})

/**
 * Readability, in every theme, on the wash a colour is actually read against.
 *
 * A hand-picked colour is one hex where the built-in pair was two, so a
 * colour that only works in Dark is a colour that breaks the day somebody
 * switches. The check is the title mix against the strongest end of the
 * wash - `.timeline-anchor-cat` and the rule above it in styles.css - rather
 * than the colour against the surface, which is a pair nothing ever paints
 * next to each other.
 *
 * A palette entry that fails here is not mergeable, for the same reason a
 * preset that fails theme-contrast.test.ts is not.
 */
for (const swatch of CATEGORY_PALETTE) {
  for (const ground of themeGrounds()) {
    test(`${swatch.name} reads at ${MIN_CATEGORY_CONTRAST}:1 on ${ground.name}`, () => {
      expect(categoryContrast(swatch.value, ground.surface, ground.text)).toBeGreaterThanOrEqual(
        MIN_CATEGORY_CONTRAST,
      )
    })
  }
}

test('every palette colour passes the same gate a hand-typed hex has to', () => {
  for (const swatch of CATEGORY_PALETTE) expect(isCategoryColorReadable(swatch.value)).toBe(true)
})

test('the palette offers twelve distinct colours and no grey', () => {
  expect(CATEGORY_PALETTE).toHaveLength(12)
  expect(new Set(CATEGORY_PALETTE.map(c => c.value)).size).toBe(12)
  // Grey means "finished" everywhere else in this app - see the note on
  // DEFAULT_CATEGORIES - so a grey category would read as already behind you.
  for (const { value } of CATEGORY_PALETTE) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16))
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(30)
  }
})

test('a value that is not a hex colour is refused rather than guessed at', () => {
  expect(isCategoryColorReadable('rebeccapurple')).toBe(false)
  expect(isCategoryColorReadable('url(https://example.com/x.png)')).toBe(false)
  expect(isCategoryColorReadable('')).toBe(false)
  expect(isCategoryColorReadable('#5b8ae6')).toBe(true)
})

test('a colour is named where it has a name, and by its own hex where it does not', () => {
  expect(categoryColorName('#5b8ae6')).toBe('Blue')
  expect(categoryColorName('#5B8AE6')).toBe('Blue')
  expect(categoryColorName('#123456')).toBe('#123456')
})

test('every theme the app ships is covered, not only the one currently painting', () => {
  const names = themeGrounds().map(g => g.name)
  expect(names).toContain('Dark (dark)')
  expect(names).toContain('Light (light)')
  expect(names).toContain('Midnight (dark)')
})
