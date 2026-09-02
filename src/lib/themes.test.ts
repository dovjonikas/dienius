import { expect, test } from 'vitest'
import { DEFAULT_PRESET_ID, findPreset, PRESETS } from './themes'

const TOKEN_KEYS = [
  'bg', 'surface', 'surfaceRaised', 'rule', 'ruleSize', 'grain', 'vignette', 'border', 'margin',
  'text', 'muted', 'faint', 'accent', 'accentDim', 'mark', 'danger', 'good',
  'fontDisplay', 'fontBody', 'fontMono', 'radius', 'edge', 'shadow',
] as const

const FONT_KEYS = ['fontDisplay', 'fontBody', 'fontMono'] as const

test('the three themes this app ships are the three it ships', () => {
  expect(PRESETS.map(p => p.id)).toEqual(['dark', 'light', 'midnight'])
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

// Every theme is single-mode by design - with three fixed themes, light or
// dark is the choice itself rather than a second axis crossed with it. Pinned
// here because it is load-bearing: presetFor in theme.ts follows the system by
// swapping the theme, which only makes sense while this holds.
test('every theme ships exactly one mode', () => {
  for (const preset of PRESETS) {
    expect(preset.modes.length, preset.id).toBe(1)
  }
  expect(findPreset('light').modes).toEqual(['light'])
  expect(findPreset('dark').modes).toEqual(['dark'])
  expect(findPreset('midnight').modes).toEqual(['dark'])
})

test('findPreset falls back to the default preset for an unknown id', () => {
  expect(findPreset('does-not-exist').id).toBe(DEFAULT_PRESET_ID)
})

test('findPreset returns the matching preset for a known id', () => {
  expect(findPreset('midnight').id).toBe('midnight')
})

// The eight novelty presets were cut - see the note at the top of themes.ts.
// Their ids are what a real person still has in storage, so what matters is
// not that they are gone but that they land somewhere sensible when they turn
// up, which they will, on every existing install.
test('an id from one of the deleted themes resolves to the default rather than failing', () => {
  for (const gone of ['slate', 'sketchbook', 'graph', 'legal-pad', 'moleskine', 'blueprint', 'terminal', 'newsprint', 'receipt', 'ink-and-wash']) {
    expect(findPreset(gone).id, gone).toBe(DEFAULT_PRESET_ID)
  }
})

test('preset names are unique', () => {
  const names = PRESETS.map(p => p.name)
  expect(new Set(names).size).toBe(names.length)
})

// docs/THEMES.md section 2: no script, handwritten or novelty face on any
// token, on any preset, ever. theme-override-options.test.ts already checks
// this for the panel's own four Type options - this checks every font token
// every shipped preset actually carries, so a future preset cannot slip a
// decorative face past that narrower check.
test('no preset carries a script, handwritten or novelty font stack on any token', () => {
  for (const preset of PRESETS) {
    for (const mode of preset.modes) {
      const variant = mode === 'light' ? preset.light : preset.dark
      for (const key of FONT_KEYS) {
        expect(variant!.tokens[key], `${preset.id} ${mode} ${key}`).not.toMatch(/comic sans|script|cursive|hand/i)
      }
    }
  }
})
