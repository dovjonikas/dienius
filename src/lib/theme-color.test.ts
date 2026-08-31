import { beforeEach, expect, test } from 'vitest'
import { syncThemeColorMeta } from './theme-color'

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#fafaf8" />'
})

test('syncThemeColorMeta updates the existing meta tag to the given color', () => {
  syncThemeColorMeta('#191a1d')
  const meta = document.querySelector('meta[name="theme-color"]')
  expect(meta?.getAttribute('content')).toBe('#191a1d')
})

test('syncThemeColorMeta switches back when called again with a different color', () => {
  syncThemeColorMeta('#191a1d')
  syncThemeColorMeta('#fafaf8')
  const meta = document.querySelector('meta[name="theme-color"]')
  expect(meta?.getAttribute('content')).toBe('#fafaf8')
})

test('syncThemeColorMeta does nothing if no meta tag is present', () => {
  document.head.innerHTML = ''
  expect(() => syncThemeColorMeta('#191a1d')).not.toThrow()
})
