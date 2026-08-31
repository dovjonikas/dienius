import { expect, test } from 'vitest'
import { contrastWarnings, MIN_ACCENT_CONTRAST, MIN_TEXT_CONTRAST } from './theme-override-warnings'
import { findPreset } from './themes'

test('a preset that already passes the contrast gate produces no warnings', () => {
  const tokens = findPreset('sketchbook').dark!.tokens
  expect(contrastWarnings(tokens)).toEqual([])
})

test('warns when a hand-picked text color no longer reads against the paper', () => {
  const base = findPreset('slate').light!.tokens
  const warnings = contrastWarnings({ ...base, text: '#fafaf8' })
  expect(warnings.length).toBeGreaterThan(0)
  expect(warnings.some(w => w.message.includes('Text'))).toBe(true)
})

test('warns when a hand-picked accent color no longer reads against a card', () => {
  const base = findPreset('slate').light!.tokens
  const warnings = contrastWarnings({ ...base, accent: '#ffffff' })
  expect(warnings.some(w => w.message.includes('Accent'))).toBe(true)
})

test('checks both the paper and the card surface, not just one ground', () => {
  const base = findPreset('slate').light!.tokens
  // bg and surface are both near-white on Slate light, so a near-white text
  // color should fail against both grounds, producing two text warnings.
  const warnings = contrastWarnings({ ...base, text: '#fefefe' })
  const textWarnings = warnings.filter(w => w.message.includes('Text'))
  expect(textWarnings.length).toBe(2)
})

test('the thresholds match the merge-time contrast gate', () => {
  expect(MIN_TEXT_CONTRAST).toBe(4.5)
  expect(MIN_ACCENT_CONTRAST).toBe(3)
})

test('never throws on a malformed color, and simply skips warning about it', () => {
  const base = findPreset('slate').light!.tokens
  expect(() => contrastWarnings({ ...base, text: 'not-a-color' })).not.toThrow()
})
