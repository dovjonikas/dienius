import { expect, test } from 'vitest'
import {
  clampOpacityPercent,
  clampRuleSize,
  colorOpacityPercent,
  EDGE_OPTIONS,
  FONT_BODY_OPTIONS,
  optionIdForValue,
  parseColorRgb,
  parseRuleSize,
  RULE_STYLE_OPTIONS,
  withOpacityPercent,
} from './theme-override-options'

test('every edge and font body option has a unique id and a non-empty value', () => {
  for (const options of [EDGE_OPTIONS, FONT_BODY_OPTIONS]) {
    const ids = options.map(o => o.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const option of options) {
      expect(option.value.length).toBeGreaterThan(0)
    }
  }
})

test('no font body option resolves to a script, handwritten or novelty stack', () => {
  for (const option of FONT_BODY_OPTIONS) {
    expect(option.value).not.toMatch(/comic sans|script|cursive|hand/i)
  }
})

test('rule style options are exactly none, lines and squares', () => {
  expect(RULE_STYLE_OPTIONS.map(o => o.id)).toEqual(['none', 'lines', 'squares'])
})

test('optionIdForValue finds the option matching a resolved token value', () => {
  const soft = EDGE_OPTIONS.find(o => o.id === 'soft')!
  expect(optionIdForValue(EDGE_OPTIONS, soft.value)).toBe('soft')
})

test('optionIdForValue returns undefined for a value matching no option', () => {
  expect(optionIdForValue(EDGE_OPTIONS, '999px')).toBeUndefined()
})

test('clampRuleSize keeps spacing between the notebook-noise and paper-losing bounds', () => {
  expect(clampRuleSize(4)).toBe(20)
  expect(clampRuleSize(28)).toBe(28)
  expect(clampRuleSize(90)).toBe(40)
})

test('parseRuleSize reads a css px string and falls back to the minimum on garbage', () => {
  expect(parseRuleSize('28px')).toBe(28)
  expect(parseRuleSize('not-a-number')).toBe(20)
})

test('clampOpacityPercent stays within 0 and 40', () => {
  expect(clampOpacityPercent(-5)).toBe(0)
  expect(clampOpacityPercent(20)).toBe(20)
  expect(clampOpacityPercent(90)).toBe(40)
})

test('parseColorRgb reads 3, 6 and 8 digit hex the same way', () => {
  expect(parseColorRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  expect(parseColorRgb('#6fa8ff')).toEqual({ r: 111, g: 168, b: 255 })
  expect(parseColorRgb('#6fa8ff40')).toEqual({ r: 111, g: 168, b: 255 })
})

test('parseColorRgb reads rgb() and rgba() forms', () => {
  expect(parseColorRgb('rgb(130, 170, 255)')).toEqual({ r: 130, g: 170, b: 255 })
  expect(parseColorRgb('rgba(130, 170, 255, 0.09)')).toEqual({ r: 130, g: 170, b: 255 })
})

test('parseColorRgb returns null for a string it cannot read', () => {
  expect(parseColorRgb('not a color')).toBeNull()
})

test('colorOpacityPercent reads the alpha channel out of hex8 and rgba, as a percent', () => {
  expect(colorOpacityPercent('rgba(130, 170, 255, 0.09)')).toBe(9)
  expect(colorOpacityPercent('#6fa8ff40')).toBe(Math.round((0x40 / 255) * 100))
})

test('colorOpacityPercent reads a plain opaque color as fully visible', () => {
  expect(colorOpacityPercent('#6fa8ff')).toBe(100)
  expect(colorOpacityPercent('rgb(130, 170, 255)')).toBe(100)
})

test('withOpacityPercent keeps the base color and rewrites only the alpha', () => {
  expect(withOpacityPercent('rgba(130, 170, 255, 0.09)', 20)).toBe('rgba(130, 170, 255, 0.2)')
  expect(withOpacityPercent('#6fa8ff', 9)).toBe('rgba(111, 168, 255, 0.09)')
})

test('withOpacityPercent clamps out-of-range percentages before writing them', () => {
  expect(withOpacityPercent('#6fa8ff', 95)).toBe('rgba(111, 168, 255, 0.4)')
  expect(withOpacityPercent('#6fa8ff', -5)).toBe('rgba(111, 168, 255, 0)')
})
