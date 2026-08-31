/**
 * Discrete option sets for the "Adjust this theme" panel's segmented
 * controls - Corners, Type, and Ruling's style - plus the small color-math
 * helpers the Ruling spacing and opacity controls need. Each option's
 * `value` is the literal token value picking it writes, so a control never
 * has to know anything about CSS beyond "which option is currently picked".
 */
import { HAND_DRAWN_EDGE, SHARP_EDGE, SOFT_EDGE, SYSTEM_MONO, SYSTEM_ROUNDED, SYSTEM_SANS, SYSTEM_SERIF_DISPLAY } from './themes'
import type { RuleStyle } from './themes'

export interface OverrideOption {
  id: string
  label: string
  value: string
}

// Corners: soft / sharp / hand-drawn, docs/THEMES.md section 3. Writes --edge.
export const EDGE_OPTIONS: OverrideOption[] = [
  { id: 'soft', label: 'Soft', value: SOFT_EDGE },
  { id: 'sharp', label: 'Sharp', value: SHARP_EDGE },
  { id: 'hand-drawn', label: 'Hand-drawn', value: HAND_DRAWN_EDGE },
]

// Type: system / rounded / mono / serif, docs/THEMES.md section 3. The
// spec's earlier draft named a fourth option, handwritten, in place of
// serif - dropped everywhere, including here, per section 2's rule that no
// control ever offers a script or novelty face. Writes --font-body, the
// token every reading surface in the app already uses, so the choice is
// felt on the actual task list rather than only on a header. --font-display
// stays with the preset (or its own override), unaffected by this control.
export const FONT_BODY_OPTIONS: OverrideOption[] = [
  { id: 'system', label: 'System', value: SYSTEM_SANS },
  { id: 'rounded', label: 'Rounded', value: SYSTEM_ROUNDED },
  { id: 'mono', label: 'Mono', value: SYSTEM_MONO },
  { id: 'serif', label: 'Serif', value: SYSTEM_SERIF_DISPLAY },
]

// Ruling style: none / lines / squares, docs/THEMES.md section 3. Not a
// ThemeTokens key - resolveTheme reads `ruleStyle` straight off the same
// override patch object. No `value` field: the id is the value.
export const RULE_STYLE_OPTIONS: { id: RuleStyle; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'lines', label: 'Lines' },
  { id: 'squares', label: 'Squares' },
]

/** Which option's value matches a resolved token value, if any - used to
 * highlight the current selection in a segmented control. A value with no
 * matching option (a future preset shipping a corner shape none of these
 * three name) simply highlights nothing rather than guessing. */
export function optionIdForValue(options: OverrideOption[], value: string): string | undefined {
  return options.find(o => o.value === value)?.id
}

// Ruling spacing bounds, docs/THEMES.md section 5: "around 28px feels like
// a notebook; below 20px it turns into noise on a phone." 40px is this
// panel's own upper bound - past that the page stops reading as ruled paper
// at all.
const RULE_SIZE_MIN = 20
const RULE_SIZE_MAX = 40

export function clampRuleSize(px: number): number {
  return Math.min(RULE_SIZE_MAX, Math.max(RULE_SIZE_MIN, px))
}

/** Reads a `NNpx` token value back into a plain number for the spacing
 * slider. Anything that does not parse falls back to the minimum rather
 * than producing NaN on the control. */
export function parseRuleSize(value: string): number {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : RULE_SIZE_MIN
}

// Ruling opacity bounds. Every shipped preset's rule alpha sits well under
// this - 40% is deliberately generous headroom for a person who wants a
// bolder grid than any preset ships, without letting the slider run all the
// way to a fully opaque line that would stop reading as paper.
const OPACITY_MIN = 0
const OPACITY_MAX = 40

export function clampOpacityPercent(percent: number): number {
  return Math.min(OPACITY_MAX, Math.max(OPACITY_MIN, percent))
}

/**
 * Parses r, g, b out of a hex (#rgb, #rrggbb, #rrggbbaa) or rgb()/rgba()
 * color string. Returns null for anything else rather than throwing - this
 * only ever reads a preset's own `rule` token or a value this module itself
 * wrote, both closed, known-good sets, but a null fallback keeps a future
 * preset's color-math quirk from crashing the whole panel.
 */
export function parseColorRgb(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  if (hex) {
    const digits = hex[1]
    if (digits.length === 3) {
      const [r, g, b] = digits.split('')
      return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) }
    }
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
    }
  }
  const fn = color.trim().match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/i)
  if (fn) {
    return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]) }
  }
  return null
}

/** Reads the alpha channel out of a color string as a 0-100 percent, to
 * pre-fill the opacity slider with whatever is actually resolved right now.
 * A plain opaque color (rgb()/hex6/hex3) reads as fully visible; a string
 * this module cannot parse at all falls back to the panel's own minimum
 * rather than crashing the slider. */
export function colorOpacityPercent(color: string): number {
  const hex8 = color.trim().match(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})$/)
  if (hex8) return Math.round((parseInt(hex8[1], 16) / 255) * 100)
  const rgba = color.trim().match(/^rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*([\d.]+)\s*\)$/i)
  if (rgba) return Math.round(Number(rgba[1]) * 100)
  if (parseColorRgb(color)) return 100
  return OPACITY_MIN
}

/** Rewrites a color's alpha channel, keeping its rgb - what the Ruling
 * opacity slider actually writes into the `rule` token. Falls back to a
 * plain mid-grey rgb if the base color could not be parsed, so the control
 * still writes something rather than nothing. */
export function withOpacityPercent(color: string, percent: number): string {
  const rgb = parseColorRgb(color) ?? { r: 128, g: 128, b: 128 }
  const alpha = clampOpacityPercent(percent) / 100
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${round2(alpha)})`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
