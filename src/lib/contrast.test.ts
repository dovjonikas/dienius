import { expect, test } from 'vitest'
import { contrastRatio, parseHexColor, relativeLuminance } from './contrast'

test('parseHexColor reads both three and six digit hex', () => {
  expect(parseHexColor('#fff')).toEqual({ r: 255, g: 255, b: 255 })
  expect(parseHexColor('#ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  expect(parseHexColor('#000')).toEqual({ r: 0, g: 0, b: 0 })
  expect(parseHexColor('#5b7cfa')).toEqual({ r: 91, g: 124, b: 250 })
})

test('parseHexColor throws on anything that is not hex', () => {
  expect(() => parseHexColor('red')).toThrow()
  expect(() => parseHexColor('rgba(0,0,0,0.5)')).toThrow()
  expect(() => parseHexColor('#12345')).toThrow()
})

test('relativeLuminance is 0 for black and 1 for white', () => {
  expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
})

test('contrastRatio of black on white is the textbook maximum, 21:1', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
})

test('contrastRatio is symmetric - argument order does not matter', () => {
  expect(contrastRatio('#2b2b2b', '#fafaf8')).toBeCloseTo(contrastRatio('#fafaf8', '#2b2b2b'), 10)
})

test('contrastRatio of a color against itself is 1', () => {
  expect(contrastRatio('#5b7cfa', '#5b7cfa')).toBeCloseTo(1, 5)
})

// A known reference pair: WCAG's own worked example puts #767676 on white
// right at the 4.5:1 body text threshold.
test('contrastRatio matches the known #767676 on white reference point', () => {
  expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5)
  expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5)
})
