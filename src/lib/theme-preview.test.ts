import { expect, test } from 'vitest'
import { buildPreviewStyle, markInk } from './theme-preview'
import { findPreset } from './themes'

test('buildPreviewStyle copies every surface and palette token the miniature paints with', () => {
  const variant = findPreset('sketchbook').dark!
  const style = buildPreviewStyle(variant.tokens, variant.ruleStyle)
  expect(style['--pv-bg']).toBe(variant.tokens.bg)
  expect(style['--pv-surface']).toBe(variant.tokens.surface)
  expect(style['--pv-border']).toBe(variant.tokens.border)
  expect(style['--pv-text']).toBe(variant.tokens.text)
  expect(style['--pv-muted']).toBe(variant.tokens.muted)
  expect(style['--pv-accent']).toBe(variant.tokens.accent)
  expect(style['--pv-mark']).toBe(variant.tokens.mark)
  expect(style['--pv-rule-size']).toBe(variant.tokens.ruleSize)
  expect(style['--pv-grain']).toBe(variant.tokens.grain)
  expect(style['--pv-vignette']).toBe(variant.tokens.vignette)
  expect(style['--pv-font-display']).toBe(variant.tokens.fontDisplay)
  expect(style['--pv-font-body']).toBe(variant.tokens.fontBody)
  expect(style['--pv-radius']).toBe(variant.tokens.radius)
  expect(style['--pv-edge']).toBe(variant.tokens.edge)
  expect(style['--pv-shadow']).toBe(variant.tokens.shadow)
})

test('buildPreviewStyle derives both ruling axes for a squares preset, same as the real page', () => {
  const variant = findPreset('sketchbook').light!
  const style = buildPreviewStyle(variant.tokens, 'squares')
  expect(style['--pv-rule-h']).toBe(variant.tokens.rule)
  expect(style['--pv-rule-v']).toBe(variant.tokens.rule)
})

test('buildPreviewStyle draws only the horizontal axis for a lines preset', () => {
  const variant = findPreset('sketchbook').light!
  const style = buildPreviewStyle(variant.tokens, 'lines')
  expect(style['--pv-rule-h']).toBe(variant.tokens.rule)
  expect(style['--pv-rule-v']).toBe('transparent')
})

test('buildPreviewStyle draws neither ruling axis for a plain preset, like Slate', () => {
  const variant = findPreset('slate').light!
  const style = buildPreviewStyle(variant.tokens, variant.ruleStyle)
  expect(style['--pv-rule-h']).toBe('transparent')
  expect(style['--pv-rule-v']).toBe('transparent')
})

test('markInk picks black ink for a light, yellow highlighter', () => {
  expect(markInk('#ffd54a')).toBe('#000000')
})

test('markInk picks white ink for a dark mark color', () => {
  expect(markInk('#1a1a1a')).toBe('#ffffff')
})

test('markInk always returns a color that reads at least 4.5:1 against the mark it was given, across every shipped preset', () => {
  // Exercises the actual preset data rather than made-up colors, so a
  // future preset with an unusual mark color is covered automatically.
  const presets = [findPreset('slate'), findPreset('sketchbook')]
  for (const preset of presets) {
    for (const mode of preset.modes) {
      const variant = mode === 'light' ? preset.light! : preset.dark!
      const ink = markInk(variant.tokens.mark)
      expect(ink === '#000000' || ink === '#ffffff').toBe(true)
    }
  }
})
