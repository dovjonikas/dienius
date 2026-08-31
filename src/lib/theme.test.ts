import { expect, test } from 'vitest'
import { applyResolvedTheme, CSS_VAR_NAMES, resolveMode, resolveTheme, resolveVariant, ruleAxisColors, TOKEN_KEYS } from './theme'
import { contrastRatio } from './contrast'
import { findPreset } from './themes'
import type { ThemeState } from './types'

function state(overrides: Partial<ThemeState> = {}): ThemeState {
  return { presetId: 'slate', overrides: {}, mode: 'light', ...overrides }
}

test('resolves the light variant of the requested preset', () => {
  const resolved = resolveTheme(state({ presetId: 'sketchbook', mode: 'light' }), false)
  expect(resolved.mode).toBe('light')
  expect(resolved.tokens.bg).toBe(findPreset('sketchbook').light!.tokens.bg)
})

test('resolves the dark variant of the requested preset', () => {
  const resolved = resolveTheme(state({ presetId: 'sketchbook', mode: 'dark' }), false)
  expect(resolved.mode).toBe('dark')
  expect(resolved.tokens.bg).toBe(findPreset('sketchbook').dark!.tokens.bg)
})

test('system mode follows the live OS preference', () => {
  expect(resolveTheme(state({ mode: 'system' }), true).mode).toBe('dark')
  expect(resolveTheme(state({ mode: 'system' }), false).mode).toBe('light')
})

test('an unknown preset id falls back to the default preset rather than throwing', () => {
  const resolved = resolveTheme(state({ presetId: 'not-a-real-preset' }), false)
  expect(resolved.tokens.bg).toBe(findPreset('slate').light!.tokens.bg)
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
    state({ overrides: { slate: { accent: '#e0553b' } } }),
    false,
  )
  const base = findPreset('slate').light!.tokens
  expect(overridden.tokens.accent).toBe('#e0553b')
  expect(overridden.tokens.text).toBe(base.text)
  expect(overridden.tokens.bg).toBe(base.bg)
})

test('overrides are only applied for the matching preset id', () => {
  const resolved = resolveTheme(
    state({ presetId: 'slate', overrides: { sketchbook: { accent: '#e0553b' } } }),
    false,
  )
  expect(resolved.tokens.accent).toBe(findPreset('slate').light!.tokens.accent)
})

test('switching preset and back preserves that preset\'s own override patch', () => {
  const twoPresetOverrides: ThemeState['overrides'] = {
    sketchbook: { accent: '#e0553b' },
  }
  const onSketchbook = resolveTheme(state({ presetId: 'sketchbook', mode: 'dark', overrides: twoPresetOverrides }), false)
  const onSlate = resolveTheme(state({ presetId: 'slate', overrides: twoPresetOverrides }), false)
  const backOnSketchbook = resolveTheme(state({ presetId: 'sketchbook', mode: 'dark', overrides: twoPresetOverrides }), false)
  expect(onSketchbook.tokens.accent).toBe('#e0553b')
  expect(onSlate.tokens.accent).toBe(findPreset('slate').light!.tokens.accent)
  expect(backOnSketchbook.tokens.accent).toBe('#e0553b')
})

test('an unknown token name in an override patch is ignored, not written through', () => {
  const resolved = resolveTheme(
    state({ overrides: { slate: { notARealToken: 'nonsense' } as never } }),
    false,
  )
  expect(resolved.tokens).not.toHaveProperty('notARealToken')
})

test('a ruleStyle override changes ruling without touching the rule color', () => {
  const resolved = resolveTheme(
    state({ presetId: 'sketchbook', mode: 'dark', overrides: { sketchbook: { ruleStyle: 'lines' } } }),
    false,
  )
  expect(resolved.ruleStyle).toBe('lines')
  expect(resolved.tokens.rule).toBe(findPreset('sketchbook').dark!.tokens.rule)
})

test('ruleAxisColors draws neither axis for none, one for lines, both for squares', () => {
  const tokens = findPreset('sketchbook').dark!.tokens
  expect(ruleAxisColors(tokens, 'none')).toEqual({ ruleH: 'transparent', ruleV: 'transparent' })
  expect(ruleAxisColors(tokens, 'lines')).toEqual({ ruleH: tokens.rule, ruleV: 'transparent' })
  expect(ruleAxisColors(tokens, 'squares')).toEqual({ ruleH: tokens.rule, ruleV: tokens.rule })
})

test('applyResolvedTheme writes every token as a css custom property and sets dataset.theme', () => {
  const root = document.createElement('div')
  const resolved = resolveTheme(state({ presetId: 'sketchbook', mode: 'dark' }), false)
  applyResolvedTheme(root, resolved)
  for (const key of TOKEN_KEYS) {
    const cssName = CSS_VAR_NAMES[key]
    expect(root.style.getPropertyValue(cssName), cssName).toBe(resolved.tokens[key])
  }
  expect(root.style.getPropertyValue('--rule-h')).toBe(resolved.tokens.rule)
  expect(root.style.getPropertyValue('--rule-v')).toBe(resolved.tokens.rule)
  expect(root.dataset.theme).toBe('dark')
})

test('resolveVariant is the same merge resolveTheme uses, callable with just a variant and a patch', () => {
  const variant = findPreset('sketchbook').dark!
  const resolved = resolveVariant(variant, { accent: '#e0553b' })
  expect(resolved.tokens.accent).toBe('#e0553b')
  expect(resolved.tokens.text).toBe(variant.tokens.text)
  expect(resolved.ruleStyle).toBe(variant.ruleStyle)
})

test('resolveVariant honors a ruleStyle override the same way resolveTheme does', () => {
  const variant = findPreset('sketchbook').dark!
  const resolved = resolveVariant(variant, { ruleStyle: 'none' })
  expect(resolved.ruleStyle).toBe('none')
  expect(resolved.tokens.rule).toBe(variant.tokens.rule)
})

test('applyResolvedTheme derives --safe-ink from --surface, never from --text', () => {
  const root = document.createElement('div')
  applyResolvedTheme(root, resolveTheme(state({ presetId: 'slate', mode: 'light' }), false))
  // Slate light's surface is near-white, so the safe ink is black.
  expect(root.style.getPropertyValue('--safe-ink')).toBe('#000000')
})

test('--safe-ink stays readable against --surface even when a text override would make --text itself illegible', () => {
  const root = document.createElement('div')
  const base = findPreset('slate').light!.tokens
  // The exact broken-theme repro: text set to match the paper.
  const resolved = resolveTheme(state({ overrides: { slate: { text: base.bg } } }), false)
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
