/**
 * The resolution pipeline from docs/THEMES.md section 2:
 *
 *   defaults  ->  preset  ->  user overrides  ->  live CSS custom properties on :root
 *
 * `resolveTheme` does the first three steps as a pure function - it never
 * touches the DOM, so it is what both the app (through `applyResolvedTheme`
 * below) and the pre-paint inline script in index.html need to agree on.
 * Keep this file free of anything that only makes sense once React and the
 * DOM exist; the pre-paint script cannot import it, and src/preTheme.test.ts
 * checks the script's own copy of this logic stays in step with it.
 */
import { bestInk } from './contrast'
import type { ThemeOverrides, ThemeState } from './types'
import { findPreset, SYSTEM_LIGHT_PRESET_ID, type RuleStyle, type ThemeTokens, type ThemeVariant } from './themes'

export interface ResolvedTheme {
  /** The mode actually rendered - may differ from ThemeState.mode when
   * mode is 'system' (resolved against the live OS preference) or when the
   * chosen preset does not ship the requested mode at all. */
  mode: 'light' | 'dark'
  tokens: ThemeTokens
  ruleStyle: RuleStyle
}

/** Every ThemeTokens key, in the fixed order the pre-paint script's own
 * copy of this list must match. Order has no visual effect - it exists so
 * a diff of the two lists is easy to eyeball. */
export const TOKEN_KEYS: (keyof ThemeTokens)[] = [
  'bg', 'surface', 'surfaceRaised', 'rule', 'ruleSize', 'grain', 'vignette', 'border', 'margin',
  'text', 'muted', 'faint', 'accent', 'accentDim', 'mark', 'danger', 'good',
  'fontDisplay', 'fontBody', 'fontMono', 'radius', 'edge', 'shadow',
]

/** The CSS custom property each token becomes. The one place this mapping
 * is written down - the pre-paint script's copy must produce the same
 * property names for the same keys, checked by src/preTheme.test.ts. */
export const CSS_VAR_NAMES: Record<keyof ThemeTokens, string> = {
  bg: '--bg',
  surface: '--surface',
  surfaceRaised: '--surface-raised',
  rule: '--rule',
  ruleSize: '--rule-size',
  grain: '--grain',
  vignette: '--vignette',
  border: '--border',
  margin: '--margin',
  text: '--text',
  muted: '--muted',
  faint: '--faint',
  accent: '--accent',
  accentDim: '--accent-dim',
  mark: '--mark',
  danger: '--danger',
  good: '--good',
  fontDisplay: '--font-display',
  fontBody: '--font-body',
  fontMono: '--font-mono',
  radius: '--radius',
  edge: '--edge',
  shadow: '--shadow',
}

function isRuleStyle(x: unknown): x is RuleStyle {
  return x === 'none' || x === 'lines' || x === 'squares'
}

// Applies a sparse override patch on top of a preset variant's tokens.
// Unknown keys - a stale token name from a preset this build no longer
// ships, a typo in a hand-edited backup - are silently ignored rather than
// written through, since they would otherwise set a CSS custom property
// nothing reads. `ruleStyle` is carried in the same patch object (it is
// still just a string value keyed by token name) but is not a token, so it
// is read separately by resolveTheme rather than folded into `tokens` here.
function applyOverrides(tokens: ThemeTokens, patch: ThemeOverrides): ThemeTokens {
  const result = { ...tokens }
  for (const key of TOKEN_KEYS) {
    const value = patch[key]
    if (typeof value === 'string' && value.length > 0) {
      result[key] = value
    }
  }
  return result
}

/**
 * Picks the mode to actually render. `system` resolves against the live OS
 * preference passed in by the caller. If the chosen preset does not ship
 * that mode at all, falls back to whichever mode it does ship - see
 * docs/THEMES.md section 4: "the mode toggle disables gracefully rather
 * than producing a broken light version."
 */
export function resolveMode(state: ThemeState, systemPrefersDark: boolean, availableModes: ('light' | 'dark')[]): 'light' | 'dark' {
  const requested: 'light' | 'dark' = state.mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : state.mode
  if (availableModes.includes(requested)) return requested
  return availableModes[0]
}

/**
 * Merges an override patch onto one already-chosen preset variant - the
 * last two steps of the pipeline, factored out so the gallery can resolve
 * the exact same "preset plus that preset's own patch" result a card
 * previews without a second, hand-written copy of this merge living next to
 * resolveTheme's own. See ThemeGallery.tsx: a card previews through this
 * function with the current preset and mode already known, the same way
 * resolveTheme below does after it finishes preset and mode selection.
 */
export function resolveVariant(variant: ThemeVariant, patch: ThemeOverrides): { tokens: ThemeTokens; ruleStyle: RuleStyle } {
  const tokens = applyOverrides(variant.tokens, patch)
  const ruleStyle = isRuleStyle(patch.ruleStyle) ? patch.ruleStyle : variant.ruleStyle
  return { tokens, ruleStyle }
}

/**
 * Which preset is actually rendered, which is not always the one that was
 * picked.
 *
 * Every theme this app ships is single-mode - "light or dark" is the choice
 * itself now, not a second axis crossed with it (see themes.ts). That leaves
 * "follow the system" with nothing to act on at the mode level, so it acts at
 * the preset level instead: with `mode: 'system'`, a light system gets the
 * Light theme and a dark system gets whichever dark theme was picked.
 *
 * Keeping the picked preset when the system is dark is the part worth being
 * deliberate about. Somebody who chose Midnight chose it for their screen, not
 * for the time of day, and switching them to Dark every evening would quietly
 * undo that. So system-following only ever overrides the choice in one
 * direction: toward light, when the system asks for light and the chosen
 * theme has no light to give.
 */
function presetFor(state: ThemeState, systemPrefersDark: boolean) {
  const picked = findPreset(state.presetId)
  if (state.mode !== 'system') return picked
  if (systemPrefersDark) return picked.modes.includes('dark') ? picked : findPreset('dark')
  return picked.modes.includes('light') ? picked : findPreset(SYSTEM_LIGHT_PRESET_ID)
}

/** Runs the full pipeline: defaults live inside each preset variant already
 * (every token is always present, see themes.test.ts), so this only has
 * preset selection, mode resolution and the override patch left to do. */
export function resolveTheme(state: ThemeState, systemPrefersDark: boolean): ResolvedTheme {
  const preset = presetFor(state, systemPrefersDark)
  const mode = resolveMode(state, systemPrefersDark, preset.modes)
  const variant = (mode === 'dark' ? preset.dark : preset.light) as ThemeVariant
  const patch = state.overrides[preset.id] ?? {}
  const { tokens, ruleStyle } = resolveVariant(variant, patch)
  return { mode, tokens, ruleStyle }
}

// Ruling as repeating gradients (docs/THEMES.md section 5) needs one line
// color per axis, not one color for the whole rule - squares draw both,
// lines draws only the horizontal one, none draws neither. Rather than add
// an attribute the stylesheet has to branch on, resolveTheme derives the
// two colors the gradients actually use, so the CSS itself stays a single
// static formula with no conditionals.
export function ruleAxisColors(tokens: ThemeTokens, ruleStyle: RuleStyle): { ruleH: string; ruleV: string } {
  return {
    ruleH: ruleStyle === 'none' ? 'transparent' : tokens.rule,
    ruleV: ruleStyle === 'squares' ? tokens.rule : 'transparent',
  }
}

/** Reads the live OS preference. Wrapped in try/catch for the same reason
 * the pre-paint script wraps everything - matchMedia is not guaranteed to
 * exist or behave in every environment this code runs in (tests, an
 * unusual embedded webview), and guessing 'light' is exactly the default
 * defaultData() already uses. */
export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

/** Writes a resolved theme onto an element as live CSS custom properties -
 * the last step of the pipeline. Also sets `dataset.theme` to the resolved
 * mode, which is all the pre-paint script sets before this ever runs.
 *
 * `--safe-ink` is derived, not one of TOKEN_KEYS: it is whichever of black
 * or white reads best against `--surface`. The override panel's recovery
 * controls (the "Reset to preset" button, the "Adjust this theme" toggle,
 * and each gallery card's own name label) read this instead of `--text` -
 * `--surface` is never one of the four tokens the override panel exposes,
 * so `--safe-ink` stays correct no matter what a person does to `--text`,
 * including setting it to match the paper exactly. Computed fresh here
 * rather than stored, the same way `--rule-h`/`--rule-v` are - see
 * docs/THEMES.md's override panel section for the failure this closes. */
export function applyResolvedTheme(root: HTMLElement, resolved: ResolvedTheme): void {
  for (const key of TOKEN_KEYS) {
    root.style.setProperty(CSS_VAR_NAMES[key], resolved.tokens[key])
  }
  const { ruleH, ruleV } = ruleAxisColors(resolved.tokens, resolved.ruleStyle)
  root.style.setProperty('--rule-h', ruleH)
  root.style.setProperty('--rule-v', ruleV)
  root.style.setProperty('--safe-ink', bestInk(resolved.tokens.surface))
  root.dataset.theme = resolved.mode
}
