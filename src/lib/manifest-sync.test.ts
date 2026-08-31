import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { buildManifest, syncManifestTheme } from './manifest-sync'

function realManifest(): Record<string, unknown> {
  const path = resolve(process.cwd(), 'public/manifest.webmanifest')
  return JSON.parse(readFileSync(path, 'utf-8'))
}

beforeEach(() => {
  document.head.innerHTML = '<link rel="manifest" href="manifest.webmanifest">'
})

test('buildManifest keeps every static field from the real manifest in step, checked against the file on disk', () => {
  const real = realManifest()
  const built = buildManifest('#191a1d')
  expect(built.name).toBe(real.name)
  expect(built.short_name).toBe(real.short_name)
  expect(built.description).toBe(real.description)
  expect(built.start_url).toBe(real.start_url)
  expect(built.scope).toBe(real.scope)
  expect(built.display).toBe(real.display)
  expect(built.orientation).toBe(real.orientation)
  expect(built.lang).toBe(real.lang)
  expect(built.icons).toEqual(real.icons)
})

test('buildManifest writes the given colour into both background_color and theme_color', () => {
  const built = buildManifest('#14171c')
  expect(built.background_color).toBe('#14171c')
  expect(built.theme_color).toBe('#14171c')
})

test('syncManifestTheme points the manifest link at a blob url carrying the resolved colour', () => {
  const blobs: Blob[] = []
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  URL.createObjectURL = (blob: Blob) => {
    blobs.push(blob)
    return `blob:mock-${blobs.length}`
  }
  URL.revokeObjectURL = () => {}

  try {
    syncManifestTheme('#f4ecd8')
    const link = document.querySelector('link[rel="manifest"]')
    expect(link?.getAttribute('href')).toBe('blob:mock-1')
    expect(blobs).toHaveLength(1)
    expect(blobs[0].type).toBe('application/manifest+json')
  } finally {
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
})

test('syncManifestTheme revokes the previous blob url when the theme changes again, but not the first, non-blob href', () => {
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  let counter = 0
  URL.createObjectURL = () => `blob:mock-${++counter}`
  const revoked: string[] = []
  URL.revokeObjectURL = (url: string) => revoked.push(url)

  try {
    syncManifestTheme('#191a1d')
    expect(revoked).toEqual([])
    syncManifestTheme('#fafaf8')
    expect(revoked).toEqual(['blob:mock-1'])
  } finally {
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  }
})

test('syncManifestTheme does nothing if no manifest link is present', () => {
  document.head.innerHTML = ''
  expect(() => syncManifestTheme('#191a1d')).not.toThrow()
})
