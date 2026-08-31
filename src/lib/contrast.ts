/**
 * WCAG 2.1 contrast maths, written out by hand rather than pulled in as a
 * dependency - the whole thing is a dozen lines once you have the formula,
 * and a unit test over the preset array (themes.test.ts) is what actually
 * needs this, not a general-purpose color library.
 *
 * Reference: https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

interface Rgb {
  r: number
  g: number
  b: number
}

/**
 * Parses a hex color in `#rgb` or `#rrggbb` form. Alpha channels and named
 * colors are not supported - every token this is used against (surface,
 * text, accent) is a plain opaque hex value by convention, so a color that
 * does not parse is a bug in the preset data, not a case to handle
 * gracefully. Throws rather than returning a guess.
 */
export function parseHexColor(hex: string): Rgb {
  const cleaned = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new Error(`Not a hex color: ${hex}`)
  }
  if (cleaned.length === 3) {
    const [r, g, b] = cleaned.split('')
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
    }
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    }
  }
  throw new Error(`Not a hex color: ${hex}`)
}

// Converts one 0-255 sRGB channel to its linear-light value, the step WCAG's
// relative luminance formula requires before the channels can be weighted
// and summed - straight 0-255 values are gamma-corrected, not linear.
function linearizeChannel(channel: number): number {
  const proportion = channel / 255
  return proportion <= 0.03928 ? proportion / 12.92 : Math.pow((proportion + 0.055) / 1.055, 2.4)
}

/** Relative luminance of a hex color, from 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex)
  return 0.2126 * linearizeChannel(r) + 0.7152 * linearizeChannel(g) + 0.0722 * linearizeChannel(b)
}

/**
 * WCAG contrast ratio between two colors, from 1 (identical) to 21 (black
 * on white). Order does not matter - the formula always divides the
 * lighter luminance by the darker one.
 */
export function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexA)
  const luminanceB = relativeLuminance(hexB)
  const lighter = Math.max(luminanceA, luminanceB)
  const darker = Math.min(luminanceA, luminanceB)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Picks whichever of pure black or pure white reads better against a given
 * background - the general form of the ink-picking logic theme-preview.ts's
 * markInk needs for the highlighter chip, and theme.ts's applyResolvedTheme
 * needs for `--safe-ink` (see that file for why: it is the one foreground
 * color the override panel's recovery controls use that a person can never
 * break by hand-picking a text color, because it is derived from `--surface`
 * at paint time rather than read from an overridable token).
 */
export function bestInk(background: string): string {
  const withBlack = contrastRatio('#000000', background)
  const withWhite = contrastRatio('#ffffff', background)
  return withBlack >= withWhite ? '#000000' : '#ffffff'
}
