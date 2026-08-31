import { expect, test } from 'vitest'
import { DEFAULT_PRESET_ID, findPreset, PRESETS } from './themes'

const TOKEN_KEYS = [
  'bg', 'surface', 'rule', 'ruleSize', 'grain', 'vignette', 'border',
  'text', 'muted', 'accent', 'accentDim', 'mark', 'danger', 'good',
  'fontDisplay', 'fontBody', 'fontMono', 'radius', 'edge', 'shadow',
] as const

test('there are at least the three presets this phase promises', () => {
  expect(PRESETS.length).toBeGreaterThanOrEqual(2)
  expect(PRESETS.map(p => p.id)).toContain('slate')
  expect(PRESETS.map(p => p.id)).toContain('sketchbook')
})

test('preset ids are unique', () => {
  const ids = PRESETS.map(p => p.id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('every preset declares a variant for every mode it lists, and no others', () => {
  for (const preset of PRESETS) {
    expect(preset.modes.length).toBeGreaterThan(0)
    expect(preset.modes.includes('light')).toBe(preset.light !== undefined)
    expect(preset.modes.includes('dark')).toBe(preset.dark !== undefined)
  }
})

test('every declared variant carries a value for every token this phase defines', () => {
  for (const preset of PRESETS) {
    for (const mode of preset.modes) {
      const variant = mode === 'light' ? preset.light : preset.dark
      expect(variant, `${preset.id} ${mode}`).toBeDefined()
      for (const key of TOKEN_KEYS) {
        const value = variant!.tokens[key]
        expect(typeof value, `${preset.id} ${mode} ${key}`).toBe('string')
        expect(value.length, `${preset.id} ${mode} ${key} should not be empty`).toBeGreaterThan(0)
      }
      expect(['none', 'lines', 'squares']).toContain(variant!.ruleStyle)
    }
  }
})

test('Slate and Sketchbook both ship a light and a dark variant', () => {
  for (const id of ['slate', 'sketchbook']) {
    const preset = findPreset(id)
    expect(preset.modes).toEqual(expect.arrayContaining(['light', 'dark']))
  }
})

test('findPreset falls back to the default preset for an unknown id', () => {
  expect(findPreset('does-not-exist').id).toBe(DEFAULT_PRESET_ID)
})

test('findPreset returns the matching preset for a known id', () => {
  expect(findPreset('sketchbook').id).toBe('sketchbook')
})
