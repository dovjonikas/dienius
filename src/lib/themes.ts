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
  /**
   * A single vertical accent rule at a fixed offset from the left edge -
   * the red margin line a legal pad rules onto every page. Added in the
   * step 7 preset phase rather than bolted on as a per-theme selector: it
   * is a genuine fifth surface mark alongside the ruling grid, transparent
   * (`#00000000`) for every preset that has no margin rule of its own, so
   * it costs nothing visually anywhere it is not used. See body::before
   * and .theme-card-room::before in styles.css for the one shared formula
   * every preset draws through.
   */
  margin: string
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
// A fifth stack, added for Newsprint's condensed headline type (section 6
// item 8). Genuinely condensed on Windows and most Chrome OS/Android
// builds, where 'Arial Narrow' and 'Roboto Condensed' both actually exist;
// everywhere else it falls through to the same professional system sans
// every other preset uses, never to a narrower novelty face.
export const SYSTEM_CONDENSED = "'Arial Narrow', 'Roboto Condensed', 'Segoe UI', system-ui, sans-serif"

// The hand-drawn edge from docs/THEMES.md section 5, used as-is. Because
// this is the literal value of --edge, every element already styled with
// border-radius: var(--edge) picks it up with no component changes.
// Exported alongside two siblings for the override panel's Corners control
// (section 3: soft / sharp / hand-drawn) - sharp is a crisp corner no
// shipped preset uses yet but Graph, Terminal and Blueprint will. Soft is
// deliberately the same '10px' Slate already ships as its own --edge (equal
// to --radius, a plain symmetric rounded rect) rather than a fourth,
// invented value - a preset's own stock corner and the panel's "Soft"
// option must mean the literal same thing, or the control shows nothing
// selected on a preset that is, in fact, already soft.
export const HAND_DRAWN_EDGE = '225px 14px 255px 15px / 15px 255px 14px 225px'
export const SOFT_EDGE = '10px'
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
      margin: '#00000000',
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
      margin: '#00000000',
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
      margin: '#00000000',
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
      margin: '#00000000',
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
 * Graph - the engineer's pad. Cool paper, a fine cyan grid, sharp corners,
 * mono type throughout headings and body both - the one preset where the
 * task list itself reads in a monospaced technical face, not just labels.
 * The unexpected touch: --shadow carries a crisp two-line hairline (a flat
 * outline plus a second offset rule, both at the border colour, zero blur)
 * instead of a soft drop shadow - a drafting ruler's double line under
 * every card, not a shadow at all. Both modes ship: the light room is a
 * drafting table, the dark one a CAD screen at night, and the identity
 * (grid, sharp corners, mono, the double hairline) survives the flip
 * intact rather than being invented twice.
 */
const GRAPH: ThemePreset = {
  id: 'graph',
  name: 'Graph',
  modes: ['light', 'dark'],
  light: {
    ruleStyle: 'squares',
    tokens: {
      bg: '#eef3f5',
      surface: '#ffffff',
      rule: 'rgba(0, 130, 160, 0.16)',
      ruleSize: '20px',
      grain: '0',
      vignette: '0%',
      border: '#c7d6da',
      margin: '#00000000',
      text: '#1a2226',
      muted: '#5c6b70',
      accent: '#0e7a90',
      accentDim: '#bfe4ea',
      mark: '#ffcf3d',
      danger: '#c1443a',
      good: '#2f8f5b',
      fontDisplay: SYSTEM_MONO,
      fontBody: SYSTEM_MONO,
      fontMono: SYSTEM_MONO,
      radius: '4px',
      edge: SHARP_EDGE,
      shadow: '0 0 0 1px #c7d6da, 0 3px 0 #c7d6da',
    },
  },
  dark: {
    ruleStyle: 'squares',
    tokens: {
      bg: '#10161a',
      surface: '#161e23',
      rule: 'rgba(70, 200, 220, 0.14)',
      ruleSize: '20px',
      grain: '0',
      vignette: '0%',
      border: '#2b3940',
      margin: '#00000000',
      text: '#e6f1f3',
      muted: '#8fa3aa',
      accent: '#3fd0e8',
      accentDim: '#1f4650',
      mark: '#ffcf3d',
      danger: '#e2776f',
      good: '#6fc98a',
      fontDisplay: SYSTEM_MONO,
      fontBody: SYSTEM_MONO,
      fontMono: SYSTEM_MONO,
      radius: '4px',
      edge: SHARP_EDGE,
      shadow: '0 0 0 1px #2b3940, 0 3px 0 #2b3940',
    },
  },
}

/**
 * Legal pad - warm yellow paper, horizontal blue rules, dark ink, a red
 * margin line down the left side. Light only: a legal pad is yellow paper
 * by definition, and a "dark legal pad" is not a real object anyone would
 * recognise, so no dark variant was built rather than inventing one to be
 * symmetrical. The unexpected touch is the margin rule itself - the new
 * `margin` surface token, drawn as a single vertical stripe at a fixed
 * offset in body::before/.theme-card-room::before, the one detail this
 * phase actually needed a new token for rather than a value choice on an
 * existing one.
 */
const LEGAL_PAD: ThemePreset = {
  id: 'legal-pad',
  name: 'Legal pad',
  modes: ['light'],
  light: {
    ruleStyle: 'lines',
    tokens: {
      bg: '#f6e9a4',
      surface: '#fbf3c0',
      rule: 'rgba(60, 90, 170, 0.32)',
      ruleSize: '30px',
      grain: '0.02',
      vignette: '5%',
      border: '#e0d190',
      margin: '#d1483c',
      text: '#2a2410',
      muted: '#7a6f45',
      accent: '#2c4fa0',
      accentDim: '#c3d0ee',
      mark: '#f2a93c',
      danger: '#b3392b',
      good: '#3f7d43',
      fontDisplay: SYSTEM_SERIF_DISPLAY,
      fontBody: SYSTEM_SANS,
      fontMono: SYSTEM_MONO,
      radius: '6px',
      edge: SHARP_EDGE,
      shadow: '0 1px 2px rgba(40, 30, 0, 0.12)',
    },
  },
}

/**
 * Moleskine - unruled ivory, no grid, a serif display face, generous
 * roominess. The calm one. Light only: the identity is specifically ivory
 * paper under a leather cover, not a dark-mode room, and a warm-brown
 * "dark Moleskine" tried in the browser read as muddy rather than calm -
 * see the phase report for that call. The unexpected touch: --shadow
 * carries two layers, a tight warm contact line plus a soft warm ambient
 * glow, instead of one flat drop shadow - a page lifting slightly off the
 * desk, not a component with a shadow bolted on.
 */
const MOLESKINE: ThemePreset = {
  id: 'moleskine',
  name: 'Moleskine',
  modes: ['light'],
  light: {
    ruleStyle: 'none',
    tokens: {
      bg: '#f3ede0',
      surface: '#faf6ec',
      rule: '#00000000',
      ruleSize: '28px',
      grain: '0.015',
      vignette: '4%',
      border: '#e4dcc8',
      margin: '#00000000',
      text: '#2e2a22',
      muted: '#948a72',
      accent: '#8a5a34',
      accentDim: '#e3d2bd',
      mark: '#e8b34a',
      danger: '#a4483a',
      good: '#5f7d4a',
      fontDisplay: SYSTEM_SERIF_DISPLAY,
      fontBody: SYSTEM_SANS,
      fontMono: SYSTEM_MONO,
      radius: '14px',
      edge: SOFT_EDGE,
      shadow: '0 1px 2px rgba(120, 90, 50, 0.15), 0 10px 24px rgba(120, 90, 50, 0.12)',
    },
  },
}

/**
 * The full starter set from docs/THEMES.md section 6 - Slate and Sketchbook
 * from the architecture phase, plus the nine remaining presets this phase
 * adds. Every entry here is real gallery data: adding one more later needs
 * no change to the gallery, the override panel, or the contrast gate, all
 * three of which already iterate this array rather than naming presets.
 */
export const PRESETS: ThemePreset[] = [
  SLATE,
  SKETCHBOOK,
  GRAPH,
  LEGAL_PAD,
  MOLESKINE,
]

/** The preset a fresh install, or a payload with an unknown presetId, gets. */
export const DEFAULT_PRESET_ID = 'slate'

export function findPreset(id: string): ThemePreset {
  return PRESETS.find(p => p.id === id) ?? SLATE
}
