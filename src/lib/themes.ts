/**
 * Theme presets, as data.
 *
 * A preset is not CSS - it is a plain object naming every token from the
 * three layers in docs/THEMES.md (surface, palette, type and shape) plus a
 * ruling style. Keeping it as data rather than a stylesheet means the same
 * array that paints the app can also render a gallery of preview cards
 * later, without a second copy of the values to keep in sync by hand.
 *
 * `ruleStyle` is not one of the CSS custom properties in `resolveTheme` -
 * `none` draws no ruling at all, `lines` draws only the horizontal rule,
 * `squares` draws both. See theme.ts for how that turns into the two
 * derived line-color tokens the stylesheet actually reads.
 */

export interface ThemeTokens {
  // Surface
  bg: string
  surface: string
  rule: string
  ruleSize: string
  /** Grain opacity, a plain 0-1 number as a string, e.g. '0.03'. */
  grain: string
  /** Vignette strength, a css percentage string, e.g. '7%'. */
  vignette: string
  border: string
  // Palette
  text: string
  muted: string
  accent: string
  accentDim: string
  mark: string
  danger: string
  good: string
  // Type and shape
  fontDisplay: string
  fontBody: string
  fontMono: string
  radius: string
  edge: string
  shadow: string
}

export type RuleStyle = 'none' | 'lines' | 'squares'

export interface ThemeVariant {
  tokens: ThemeTokens
  ruleStyle: RuleStyle
}

export interface ThemePreset {
  id: string
  name: string
  /** Which variants this preset actually ships. A preset missing a mode
   * here has no `light`/`dark` entry for it either - the mode toggle
   * disables that option rather than falling back to a broken guess. */
  modes: ('light' | 'dark')[]
  light?: ThemeVariant
  dark?: ThemeVariant
}

// System stacks only - no webfont is bundled in this phase. Every stack
// ends in a generic family so a platform with none of the named fonts
// still gets a same-genre fallback rather than the browser default.
//
// No script, handwritten, or novelty face anywhere, on any preset - text
// must always read as a professional, highly legible planner. A header may
// use a distinctive face only when it is a well-crafted, readable one; a
// good serif is fair game, a script is not. See docs/THEMES.md section 6
// item 1 for why this replaced the handwritten header face this phase
// shipped with originally. Exported so the override panel's Type control
// (docs/THEMES.md section 3) offers exactly these same known-good stacks
// rather than inventing a second set a preset does not actually use.
export const SYSTEM_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
export const SYSTEM_MONO = "'SF Mono', 'Cascadia Code', Consolas, 'Roboto Mono', monospace"
export const SYSTEM_SERIF_DISPLAY = "Iowan Old Style, 'Palatino Linotype', Palatino, Georgia, 'Book Antiqua', serif"
// A fourth, professional stack for the override panel's Type control -
// no preset ships this today, but "rounded" is one of the four options
// docs/THEMES.md section 3 names, and it needs to be a real, legible face
// like the other three, not a placeholder. ui-rounded is a genuine CSS
// generic family (Safari resolves it to SF Pro Rounded); every other
// platform falls through to the same system sans the other options use.
export const SYSTEM_ROUNDED = "ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, sans-serif"

// The hand-drawn edge from docs/THEMES.md section 5, used as-is. Because
// this is the literal value of --edge, every element already styled with
// border-radius: var(--edge) picks it up with no component changes.
// Exported alongside two siblings for the override panel's Corners control
// (section 3: soft / sharp / hand-drawn) - soft is a gentle rounded rect
// distinct from the small controls' own --radius, sharp is a crisp corner
// no shipped preset uses yet but Graph, Terminal and Blueprint will.
export const HAND_DRAWN_EDGE = '225px 14px 255px 15px / 15px 255px 14px 225px'
export const SOFT_EDGE = '16px'
export const SHARP_EDGE = '4px'

/**
 * Slate - the neutral fallback. This is the app's original light and dark
 * theme, carried into the new token structure without changing a single
 * value: same backgrounds, same ink, same accent, same shadow. No ruling,
 * no grain, no vignette, soft symmetric corners - a room that stays out of
 * the way, exactly as docs/THEMES.md section 6 describes it.
 */
const SLATE: ThemePreset = {
  id: 'slate',
  name: 'Slate',
  modes: ['light', 'dark'],
  light: {
    ruleStyle: 'none',
    tokens: {
      bg: '#fafaf8',
      surface: '#ffffff',
      rule: '#00000000',
      ruleSize: '28px',
      grain: '0',
      vignette: '0%',
      border: '#e8e6e1',
      text: '#2b2b2b',
      muted: '#8a8a85',
      accent: '#5b7cfa',
      accentDim: '#c3cdfa',
      mark: '#ffd54a',
      danger: '#d96c6c',
      good: '#6fae6f',
      fontDisplay: SYSTEM_SANS,
      fontBody: SYSTEM_SANS,
      fontMono: SYSTEM_MONO,
      radius: '10px',
      edge: '10px',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
    },
  },
  dark: {
    ruleStyle: 'none',
    tokens: {
      bg: '#191a1d',
      surface: '#222327',
      rule: '#ffffff00',
      ruleSize: '28px',
      grain: '0',
      vignette: '0%',
      border: '#33343a',
      text: '#e8e8e5',
      muted: '#85858a',
      accent: '#7c94ff',
      accentDim: '#3c4470',
      mark: '#e6c14a',
      danger: '#e08a8a',
      good: '#7fc47f',
      fontDisplay: SYSTEM_SANS,
      fontBody: SYSTEM_SANS,
      fontMono: SYSTEM_MONO,
      radius: '10px',
      edge: '10px',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
    },
  },
}

/**
 * Sketchbook - the reference theme. Both variants are a real surface, not a
 * fill: faint ruled squares, a trace of grain, an accent-tinted vignette at
 * the top, hand-drawn card edges. Its personality comes entirely from the
 * surface and palette, not from decorative type - headers use a distinct
 * but professional serif (SYSTEM_SERIF_DISPLAY), body text stays on the
 * same system sans every preset uses, so long lists stay easy to scan.
 */
const SKETCHBOOK: ThemePreset = {
  id: 'sketchbook',
  name: 'Sketchbook',
  modes: ['light', 'dark'],
  dark: {
    ruleStyle: 'squares',
    tokens: {
      bg: '#14171c',
      surface: '#1c202a',
      rule: 'rgba(130, 170, 255, 0.09)',
      ruleSize: '28px',
      grain: '0.025',
      vignette: '9%',
      border: '#2a2f3b',
      text: '#e8ecf5',
      muted: '#8b96b3',
      accent: '#6fa8ff',
      accentDim: '#2f4a80',
      mark: '#ffd23f',
      danger: '#e2776f',
      good: '#7fc98a',
      fontDisplay: SYSTEM_SERIF_DISPLAY,
      fontBody: SYSTEM_SANS,
      fontMono: SYSTEM_MONO,
      radius: '10px',
      edge: HAND_DRAWN_EDGE,
      shadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    },
  },
  light: {
    ruleStyle: 'squares',
    tokens: {
      bg: '#f4ecd8',
      surface: '#fffaf0',
      rule: 'rgba(80, 100, 130, 0.12)',
      ruleSize: '28px',
      grain: '0.02',
      vignette: '6%',
      border: '#e6dcc5',
      text: '#2c2a24',
      muted: '#8a8270',
      accent: '#3f6fd6',
      accentDim: '#b9cdf2',
      mark: '#f5c331',
      danger: '#c85a52',
      good: '#4f8f57',
      fontDisplay: SYSTEM_SERIF_DISPLAY,
      fontBody: SYSTEM_SANS,
      fontMono: SYSTEM_MONO,
      radius: '10px',
      edge: HAND_DRAWN_EDGE,
      shadow: '0 2px 6px rgba(60, 40, 10, 0.18)',
    },
  },
}

/**
 * The starter set. Three presets, each shipping both modes, is enough to
 * prove the architecture - the gallery, the override panel and the
 * remaining nine presets from docs/THEMES.md section 6 are later phases.
 */
export const PRESETS: ThemePreset[] = [SLATE, SKETCHBOOK]

/** The preset a fresh install, or a payload with an unknown presetId, gets. */
export const DEFAULT_PRESET_ID = 'slate'

export function findPreset(id: string): ThemePreset {
  return PRESETS.find(p => p.id === id) ?? SLATE
}
