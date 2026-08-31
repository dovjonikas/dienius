/**
 * The one color palette the app offers anywhere a person picks a color -
 * templates and if-then tags both draw from this list, so a color means
 * the same thing everywhere it shows up rather than each feature inventing
 * its own set.
 *
 * Each entry carries a name alongside its hex value. A template's color is
 * always shown next to the template's own name, so the color there is
 * decoration on top of text that already carries the meaning. A tag on an
 * if-then entry has no name of its own - the color *is* the tag - so
 * without a name attached to it here, a colorblind person or a screen
 * reader user would have no way to know what a color-only tag meant.
 */
export interface PaletteColor {
  value: string
  name: string
}

export const PALETTE_COLORS: PaletteColor[] = [
  { value: '#a7c4f5', name: 'Blue' },
  { value: '#f5b0a7', name: 'Coral' },
  { value: '#a7e3bd', name: 'Green' },
  { value: '#f5db9e', name: 'Gold' },
  { value: '#c9b3f0', name: 'Lavender' },
  { value: '#f0b3d5', name: 'Pink' },
  { value: '#9ed9e8', name: 'Teal' },
  { value: '#cde39e', name: 'Lime' },
]

/**
 * Looks up the name for a palette color. Falls back to the hex value
 * itself for a color that does not match any current palette entry - a
 * hand-edited backup, or a value from a palette this build no longer
 * offers - so a tag never renders with no readable meaning at all.
 */
export function paletteColorName(hex: string): string {
  return PALETTE_COLORS.find(c => c.value === hex)?.name ?? hex
}
