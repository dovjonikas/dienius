// A preset that fails a contrast check here must not be mergeable - see
// docs/THEMES.md section 7. Every preset, in every mode it declares, is
// checked against the two thresholds the spec names: body text needs to
// read at 4.5:1 and the accent color needs to read as a distinct mark at
// 3:1. Checked against both grounds text and accent actually render on in
// this app, not just the card surface - --bg itself is a real ground too:
// .template-editor input, .core-toggle and .block-add button all paint
// straight onto var(--bg) rather than var(--surface). Slate and Sketchbook
// keep those two close enough in luminance that checking surface alone
// would happen to pass either way, but that will not stay true once more
// of the twelve presets from docs/THEMES.md section 6 land, so both
// grounds are checked now while it costs nothing.
import { expect, test } from 'vitest'
import { contrastRatio } from './contrast'
import { PRESETS } from './themes'
import type { ThemeTokens } from './themes'

const MIN_TEXT_CONTRAST = 4.5
const MIN_ACCENT_CONTRAST = 3

const GROUNDS: { name: string; token: keyof ThemeTokens }[] = [
  { name: 'surface', token: 'surface' },
  { name: 'bg', token: 'bg' },
]

for (const preset of PRESETS) {
  for (const mode of preset.modes) {
    const variant = mode === 'light' ? preset.light : preset.dark
    if (!variant) continue
    const { tokens } = variant

    for (const ground of GROUNDS) {
      const groundColor = tokens[ground.token]

      test(`${preset.name} (${mode}): body text reads at ${MIN_TEXT_CONTRAST}:1 against ${ground.name}`, () => {
        const ratio = contrastRatio(tokens.text, groundColor)
        expect(ratio).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
      })

      test(`${preset.name} (${mode}): accent reads at ${MIN_ACCENT_CONTRAST}:1 against ${ground.name}`, () => {
        const ratio = contrastRatio(tokens.accent, groundColor)
        expect(ratio).toBeGreaterThanOrEqual(MIN_ACCENT_CONTRAST)
      })

      // Secondary text, held to the same 4.5:1 as body text rather than to a
      // lower bar for small print. Both of these carry sentences somebody is
      // expected to read and act on: --muted is the description under every
      // setting, and --danger is how the sync status says the server refused
      // the token. Light passes at 4.55, which is exactly why this is a gate
      // and not a habit.
      const SECONDARY = [
        { name: 'muted', color: tokens.muted },
        { name: 'danger', color: tokens.danger },
      ]
      for (const ink of SECONDARY) {
        test(`${preset.name} (${mode}): ${ink.name} text reads at ${MIN_TEXT_CONTRAST}:1 against ${ground.name}`, () => {
          expect(contrastRatio(ink.color, groundColor)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST)
        })
      }
    }
  }
}
