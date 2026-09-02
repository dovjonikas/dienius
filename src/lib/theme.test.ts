import { expect, test } from 'vitest'
import { applyResolvedTheme, CSS_VAR_NAMES, resolveMode, resolveTheme, resolveVariant, ruleAxisColors, TOKEN_KEYS } from './theme'
import { contrastRatio } from './contrast'
import { DEFAULT_PRESET_ID, findPreset, PRESETS } from './themes'
import type { ThemeState } from './types'

function state(overrides: Partial<ThemeState> = {}): ThemeState {
  return { presetId: 'light', overrides: {}, mode: 'light', ...overrides }
}

test('resolves the light variant of the requested preset', () => {
  const resolved = resolveTheme(state({ presetId: 'light', mode: 'light' }), false)
  expect(resolved.mode).toBe('light')
  expect(resolved.tokens.bg).toBe(findPreset('light').light!.tokens.bg)
})

test('resolves the dark variant of the requested preset', () => {
  const resolved = resolveTheme(state({ presetId: 'midnight', mode: 'dark' }), false)
  expect(resolved.mode).toBe('dark')
  expect(resolved.tokens.bg).toBe(findPreset('midnight').dark!.tokens.bg)
})

// Every theme is single-mode now, so following the system means swapping the
// theme rather than picking a variant within one - see presetFor in theme.ts.
test('system mode follows the live OS preference', () => {
  expect(resolveTheme(state({ mode: 'system' }), true).mode).toBe('dark')
  expect(resolveTheme(state({ mode: 'system' }), false).mode).toBe('light')
})

test('system mode swaps to Light when the OS asks for light and the chosen theme has no light', () => {
  const resolved = resolveTheme(state({ presetId: 'midnight', mode: 'system' }), false)
  expect(resolved.mode).toBe('light')
  expect(resolved.tokens.bg).toBe(findPreset('light').light!.tokens.bg)
})

// The one direction it deliberately does not override: somebody who picked
// Midnight picked it for their screen, not for the time of day.
test('system mode keeps the chosen dark theme when the OS asks for dark', () => {
  const resolved = resolveTheme(state({ presetId: 'midnight', mode: 'system' }), true)
  expect(resolved.tokens.bg).toBe(findPreset('midnight').dark!.tokens.bg)
})

test('an unknown preset id falls back to the default preset rather than throwing', () => {
  const resolved = resolveTheme(state({ presetId: 'not-a-real-preset', mode: 'dark' }), false)
  expect(resolved.tokens.bg).toBe(findPreset(DEFAULT_PRESET_ID).dark!.tokens.bg)
})

test('resolveMode falls back to whichever mode a preset actually has, instead of a broken guess', () => {
  expect(resolveMode(state({ mode: 'dark' }), false, ['light'])).toBe('light')
  expect(resolveMode(state({ mode: 'light' }), false, ['dark'])).toBe('dark')
  expect(resolveMode(state({ mode: 'system' }), true, ['light'])).toBe('light')
})

test('resolveMode does not fall back when the requested mode is actually available', () => {
  expect(resolveMode(state({ mode: 'dark' }), false, ['light', 'dark'])).toBe('dark')
  expect(resolveMode(state({ mode: 'light' }), false, ['light', 'dark'])).toBe('light')
})

test('an override patch replaces only the tokens it names', () => {
  const overridden = resolveTheme(
    state({ overrides: { light: { accent: '#e0553b' } } }),
    false,
  )
  const base = findPreset('light').light!.tokens
  expect(overridden.tokens.accent).toBe('#e0553b')
  expect(overridden.tokens.text).toBe(base.text)
  expect(overridden.tokens.bg).toBe(base.bg)
})

test('overrides are only applied for the matching preset id', () => {
  const resolved = resolveTheme(
    state({ presetId: 'light', overrides: { midnight: { accent: '#e0553b' } } }),
    false,
  )
  expect(resolved.tokens.accent).toBe(findPreset('light').light!.tokens.accent)
})

test('switching preset and back preserves that preset\'s own override patch', () => {
  const twoPresetOverrides: ThemeState['overrides'] = {
    midnight: { accent: '#e0553b' },
  }
  const onMidnight = resolveTheme(state({ presetId: 'midnight', mode: 'dark', overrides: twoPresetOverrides }), false)
  const onLight = resolveTheme(state({ presetId: 'light', overrides: twoPresetOverrides }), false)
  const backOnMidnight = resolveTheme(state({ presetId: 'midnight', mode: 'dark', overrides: twoPresetOverrides }), false)
  expect(onMidnight.tokens.accent).toBe('#e0553b')
  expect(onLight.tokens.accent).toBe(findPreset('light').light!.tokens.accent)
  expect(backOnMidnight.tokens.accent).toBe('#e0553b')
})

test('an unknown token name in an override patch is ignored, not written through', () => {
  const resolved = resolveTheme(
    state({ overrides: { light: { notARealToken: 'nonsense' } as never } }),
    false,
  )
  expect(resolved.tokens).not.toHaveProperty('notARealToken')
})

test('a ruleStyle override changes ruling without touching the rule color', () => {
  const resolved = resolveTheme(
    state({ presetId: 'midnight', mode: 'dark', overrides: { midnight: { ruleStyle: 'lines' } } }),
    false,
  )
  expect(resolved.ruleStyle).toBe('lines')
  expect(resolved.tokens.rule).toBe(findPreset('midnight').dark!.tokens.rule)
})

test('ruleAxisColors draws neither axis for none, one for lines, both for squares', () => {
  const tokens = findPreset('midnight').dark!.tokens
  expect(ruleAxisColors(tokens, 'none')).toEqual({ ruleH: 'transparent', ruleV: 'transparent' })
  expect(ruleAxisColors(tokens, 'lines')).toEqual({ ruleH: tokens.rule, ruleV: 'transparent' })
  expect(ruleAxisColors(tokens, 'squares')).toEqual({ ruleH: tokens.rule, ruleV: tokens.rule })
})

test('applyResolvedTheme writes every token as a css custom property and sets dataset.theme', () => {
  const root = document.createElement('div')
  const resolved = resolveTheme(state({ presetId: 'midnight', mode: 'dark' }), false)
  applyResolvedTheme(root, resolved)
  for (const key of TOKEN_KEYS) {
    const cssName = CSS_VAR_NAMES[key]
    expect(root.style.getPropertyValue(cssName), cssName).toBe(resolved.tokens[key])
  }
  // Every shipped theme has ruleStyle 'none', so both axes resolve to
  // transparent rather than to the rule colour - ruleAxisColors' own tests
  // above cover the 'lines' and 'squares' branches directly.
  expect(root.style.getPropertyValue('--rule-h')).toBe('transparent')
  expect(root.style.getPropertyValue('--rule-v')).toBe('transparent')
  expect(root.dataset.theme).toBe('dark')
})

test('resolveVariant is the same merge resolveTheme uses, callable with just a variant and a patch', () => {
  const variant = findPreset('midnight').dark!
  const resolved = resolveVariant(variant, { accent: '#e0553b' })
  expect(resolved.tokens.accent).toBe('#e0553b')
  expect(resolved.tokens.text).toBe(variant.tokens.text)
  expect(resolved.ruleStyle).toBe(variant.ruleStyle)
})

test('resolveVariant honors a ruleStyle override the same way resolveTheme does', () => {
  const variant = findPreset('midnight').dark!
  const resolved = resolveVariant(variant, { ruleStyle: 'none' })
  expect(resolved.ruleStyle).toBe('none')
  expect(resolved.tokens.rule).toBe(variant.tokens.rule)
})

test('applyResolvedTheme derives --safe-ink from --surface, never from --text', () => {
  const root = document.createElement('div')
  applyResolvedTheme(root, resolveTheme(state({ presetId: 'light', mode: 'light' }), false))
  // Slate light's surface is near-white, so the safe ink is black.
  expect(root.style.getPropertyValue('--safe-ink')).toBe('#000000')
})

test('--safe-ink stays readable against --surface even when a text override would make --text itself illegible', () => {
  const root = document.createElement('div')
  const base = findPreset('light').light!.tokens
  // The exact broken-theme repro: text set to match the paper.
  const resolved = resolveTheme(state({ overrides: { light: { text: base.bg } } }), false)
  applyResolvedTheme(root, resolved)
  const safeInk = root.style.getPropertyValue('--safe-ink')
  expect(safeInk).not.toBe(resolved.tokens.text)
  expect(contrastRatio(safeInk, resolved.tokens.surface)).toBeGreaterThanOrEqual(4.5)
})

test('applyResolvedTheme on Slate leaves ruling transparent on both axes', () => {
  const root = document.createElement('div')
  applyResolvedTheme(root, resolveTheme(state(), false))
  expect(root.style.getPropertyValue('--rule-h')).toBe('transparent')
  expect(root.style.getPropertyValue('--rule-v')).toBe('transparent')
})

// The margin rule (Legal pad's red vertical line) is a real surface token,
// carried through applyResolvedTheme like any other - transparent for
// every preset that has no use for it, a real colour only for Legal pad.
// The margin rule was Legal pad's red vertical line, and Legal pad is gone
// along with the other seven novelty themes. The token and its one shared
// formula in styles.css survive them: it is still resolved and painted like
// every other token, and an override can still set it. What changed is that
// nothing ships a value for it any more, which is exactly what these two now
// check - the pipeline still carries it, and no shipped theme draws one.
test('--margin resolves and paints through the same pipeline as every other token', () => {
  const root = document.createElement('div')
  applyResolvedTheme(root, resolveTheme(state({ presetId: 'light', overrides: { light: { margin: '#e08a8a' } } }), false))
  expect(root.style.getPropertyValue('--margin')).toBe('#e08a8a')
})

test('no shipped theme draws a margin rule', () => {
  for (const preset of PRESETS) {
    for (const mode of preset.modes) {
      const variant = mode === 'light' ? preset.light : preset.dark
      expect(variant!.tokens.margin, `${preset.id} ${mode}`).toBe('#00000000')
    }
  }
})
