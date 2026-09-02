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
  /** The card and panel surface - one step above the page. */
  surface: string
  /**
   * One step above that again: anything covering a card - a sheet, a popover,
   * the focus screen. Depth on a dark theme comes from a lighter surface, not
   * a heavier shadow, so this is a real third step rather than a synonym for
   * `surface`. On a light theme, where the card is already white, it is the
   * same value and the shadow does the work instead.
   */
  surfaceRaised: string
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
  /**
   * The third and quietest ink - disabled controls, a placeholder, anything
   * present but not currently meaningful. Deliberately below the AA threshold
   * for body text and only ever used where that is the point: text at this
   * weight is never something a person has to read.
   */
  faint: string
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
// every other preset uses, never to a narrower novelty face. Not exported
// like its four siblings above: those feed the override panel's Type
// control (theme-override-options.ts), but that control only ever touches
// `fontBody`, never `fontDisplay` - a condensed headline face is Newsprint's
// own compiled choice, not one of the four options a person can pick from
// there, so this has no legitimate use outside this file today.

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
 * Three themes, and the reasoning behind cutting the other eight.
 *
 * This app shipped eleven presets: Sketchbook, Graph, Legal pad, Moleskine,
 * Blueprint, Terminal, Newsprint, Receipt, Ink and wash, plus Slate and
 * Midnight. Every one of them worked and passed its contrast gate. They were
 * still the wrong thing to ship. A theme picker with eleven rooms in it is a
 * toy - it says the app is a demo of what surfaces are possible rather than a
 * tool somebody uses every morning, and nine of the eleven were novelty
 * choices nobody keeps past the first afternoon. The ruled paper, the grain,
 * the vignette and the margin rule all went with them.
 *
 * What is left is the choice people actually make: dark, light, or darker.
 *
 * All three are built to the same principles, and the principles are what
 * matter more than the numbers:
 *
 * - **The base is never pure.** Not #000 and not #fff. A pure black page
 *   makes every surface above it look like a hole punched in the screen, and
 *   a pure white one is a lamp pointed at the reader. Both are why an
 *   interface reads as unfinished.
 * - **Elevation is a lighter surface, not a heavier shadow.** Page, card,
 *   and the things that sit over a card each get their own step: the further
 *   from the page something is, the lighter it is. Depth without a single
 *   dark halo, which is what shadows on dark backgrounds always become.
 * - **Text is never pure white either.** Full white on a dark ground
 *   vibrates and is genuinely tiring to read at length. The values below are
 *   the opaque equivalents of white at 87 / 60 / 38 percent over each theme's
 *   own card surface, so the ratios are exactly the ones those opacities
 *   would give - while staying real colours, which every piece of contrast
 *   arithmetic in this codebase needs them to be.
 * - **Borders are barely there.** Enough to separate two surfaces, never
 *   enough to draw a grid over the page.
 * - **Colour is quieter in the dark.** A saturated hue that reads as
 *   confident on white shouts on near-black, so the dark themes take their
 *   accents desaturated and lightened, and the light theme is allowed to be
 *   the more colourful of the two.
 *
 * Every one of them ships exactly one mode. That is deliberate: with three
 * fixed themes, "light or dark" is no longer a second axis crossed with the
 * first, it is the choice itself. Following the system is still possible and
 * is handled one level up - see `resolveTheme` in theme.ts.
 */

/** No paper texture on any of the three - see the note above. */
const NO_SURFACE = {
  rule: '#00000000',
  ruleSize: '28px',
  grain: '0',
  vignette: '0%',
  margin: '#00000000',
} as const

const TYPE_AND_SHAPE = {
  fontDisplay: SYSTEM_SANS,
  fontBody: SYSTEM_SANS,
  fontMono: SYSTEM_MONO,
  radius: '10px',
  edge: '12px',
} as const

/**
 * Dark - the default, and the one this app is designed in.
 *
 * #121417 rather than black: a dark grey with a trace of warmth in it, so the
 * page reads as a material rather than as an absence. Cards sit six percent
 * lighter, and anything covering a card sits six percent lighter again, which
 * is what carries depth here - the shadow token is almost incidental.
 */
const DARK: ThemePreset = {
  id: 'dark',
  name: 'Dark',
  modes: ['dark'],
  dark: {
    ruleStyle: 'none',
    tokens: {
      ...NO_SURFACE,
      ...TYPE_AND_SHAPE,
      bg: '#121417',
      surface: '#1a1d21',
      surfaceRaised: '#23272c',
      border: '#2a2d31',
      text: '#e2e2e0',
      muted: '#a3a5a6',
      faint: '#717375',
      accent: '#8aa4f2',
      accentDim: '#38406a',
      mark: '#d9b15f',
      danger: '#d99191',
      good: '#85be92',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.45)',
    },
  },
}

/**
 * Light - warm off-white paper, not a spotlight.
 *
 * The page is #f6f5f2 and cards are pure white, which is the inversion that
 * makes light mode work: white stops being the background and becomes the
 * elevation, so a card is legible as a card without needing a border loud
 * enough to see. Ink is #2a2d31, never black - maximum contrast is not the
 * same thing as maximum readability, and the difference is exactly the glare.
 */
const LIGHT: ThemePreset = {
  id: 'light',
  name: 'Light',
  modes: ['light'],
  light: {
    ruleStyle: 'none',
    tokens: {
      ...NO_SURFACE,
      ...TYPE_AND_SHAPE,
      bg: '#f6f5f2',
      surface: '#ffffff',
      surfaceRaised: '#ffffff',
      border: '#e6e4df',
      text: '#2a2d31',
      muted: '#6b7075',
      faint: '#a0a4a8',
      accent: '#4666e0',
      accentDim: '#c7d0f7',
      mark: '#efc14e',
      danger: '#c4534f',
      good: '#4e9663',
      shadow: '0 1px 2px rgba(0, 0, 0, 0.05), 0 2px 8px rgba(0, 0, 0, 0.04)',
    },
  },
}

/**
 * Midnight - the same theme as Dark, taken down to where an OLED panel
 * actually switches its pixels off.
 *
 * Not a different design, a different base. Everything about how the three
 * surface steps relate, and every text ratio, is identical to Dark - only the
 * floor moves, from #121417 to #0b0c0f. Kept as its own theme rather than a
 * toggle inside Dark because on an LCD it is worse, not better, and that is a
 * choice about a screen rather than a preference about a look.
 */
const MIDNIGHT: ThemePreset = {
  id: 'midnight',
  name: 'Midnight',
  modes: ['dark'],
  dark: {
    ruleStyle: 'none',
    tokens: {
      ...NO_SURFACE,
      ...TYPE_AND_SHAPE,
      bg: '#0b0c0f',
      surface: '#14161a',
      surfaceRaised: '#1d2025',
      border: '#212429',
      text: '#e0e1e2',
      muted: '#9ea1a4',
      faint: '#6c6f73',
      accent: '#7fa0f0',
      accentDim: '#2e3760',
      mark: '#d4ac5c',
      danger: '#d68c8c',
      good: '#7fba8c',
      shadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
    },
  },
}

export const PRESETS: ThemePreset[] = [DARK, LIGHT, MIDNIGHT]

/** The preset a fresh install, or a payload with an unknown presetId, gets. */
export const DEFAULT_PRESET_ID = 'dark'

/**
 * The theme used when the system asks for light and the chosen one cannot
 * provide it - see `resolveTheme`. Named rather than inlined because two
 * places need to agree on it: the resolver here, and the pre-paint script in
 * index.html that runs before any of this module exists.
 */
export const SYSTEM_LIGHT_PRESET_ID = 'light'

/**
 * Any id this build no longer ships - one of the eight deleted themes, a
 * typo, a hand-edited backup - resolves to the default rather than failing.
 * Nothing has to migrate for that to work; a stored `presetId` of
 * 'sketchbook' simply renders as Dark from the next load onward.
 */
export function findPreset(id: string): ThemePreset {
  return PRESETS.find(p => p.id === id) ?? DARK
}
