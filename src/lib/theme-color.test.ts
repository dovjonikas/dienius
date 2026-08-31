import { beforeEach, expect, test } from 'vitest'
import { syncThemeColorMeta, themeColorFor } from './theme-color'

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="#fafaf8" />'
})

test('themeColorFor returns the matching bg for each theme', () => {
  expect(themeColorFor('light')).toBe('#fafaf8')
  expect(themeColorFor('dark')).toBe('#191a1d')
})

test('syncThemeColorMeta updates the existing meta tag content', () => {
  syncThemeColorMeta('dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  expect(meta?.getAttribute('content')).toBe('#191a1d')
})

test('syncThemeColorMeta switches back when the theme switches back', () => {
  syncThemeColorMeta('dark')
  syncThemeColorMeta('light')
  const meta = document.querySelector('meta[name="theme-color"]')
  expect(meta?.getAttribute('content')).toBe('#fafaf8')
})

test('syncThemeColorMeta does nothing if no meta tag is present', () => {
  document.head.innerHTML = ''
  expect(() => syncThemeColorMeta('dark')).not.toThrow()
})
