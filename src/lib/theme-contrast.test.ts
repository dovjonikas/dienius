// A preset that fails a contrast check here must not be mergeable - see
// docs/THEMES.md section 7. Every preset, in every mode it declares, is
// checked against the two thresholds the spec names: body text needs to
// read at 4.5:1 against the surface it actually sits on, and the accent
// color needs to read as a distinct mark at 3:1 against that same surface.
import { expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { PRESETS } from './themes'

const MIN_TEXT_CONTRAST = 4.5
const MIN_ACCENT_CONTRAST = 3

for (const preset of PRESETS) {
  for (const mode of preset.modes) {
    const variant = mode === 'light' ? preset.light : preset.dark
    if (!variant) continue
    const { tokens } = variant

    test(`${preset.name} (${mode}): body text reads at ${MIN_TEXT_CONTRAST}:1 against its surface`, () => {
      const ratio = contrastRatio(tokens.text, tokens.surface)
      expect(ratio).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
    })

    test(`${preset.name} (${mode}): accent reads at ${MIN_ACCENT_CONTRAST}:1 against its surface`, () => {
      const ratio = contrastRatio(tokens.accent, tokens.surface)
      expect(ratio).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST)
    })
  }
}
