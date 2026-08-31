import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { loadData, STORAGE_KEY } from './lib/storage'

// Runs the actual inline script from index.html rather than a
// re-implementation of it - a re-implementation could quietly drift from
// what ships and this test would keep passing regardless. Locating it by
// the script's own id, rather than by position, so reordering index.html's
// head does not silently start matching the wrong tag. Resolved from the
// process working directory - vitest always runs from the repo root here -
// rather than import.meta.url, which points into Vite's own module
// resolution rather than a plain file path under this setup.
function prePaintScriptSource(): string {
  const indexHtmlPath = resolve(process.cwd(), 'index.html')
  const html = readFileSync(indexHtmlPath, 'utf-8')
  const match = html.match(/<script id="pre-paint-theme">([\s\S]*?)<\/script>/)
  if (!match) throw new Error('pre-paint-theme script not found in index.html')
  return match[1]
}

const SCRIPT_SOURCE = prePaintScriptSource()

function runPrePaintScript(): void {
  delete document.documentElement.dataset.theme
  // eslint-disable-next-line no-new-func
  new Function(SCRIPT_SOURCE)()
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

// Each case checks that the pre-paint script's synchronous, pre-mount guess
// (document.documentElement.dataset.theme) matches what loadData() commits
// to once the app actually mounts. If they ever disagree, the page renders
// one theme and then flips to the other right after - the exact defect
// this pair of tests exists to catch before it ships again.
function expectAgreement() {
  const prePaintTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  expect(prePaintTheme).toBe(loadData().settings.theme.mode)
}

test('agree on a clean, fully valid dark payload', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'dark', enabledWidgets: [] },
    ifThens: [],
  }))
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expectAgreement()
})

test('agree on a clean, fully valid light payload', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'light', enabledWidgets: [] },
    ifThens: [],
  }))
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expectAgreement()
})

test('agree when the payload has a valid dark theme but a malformed template elsewhere', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [{}],
    days: {},
    settings: { theme: 'dark', enabledWidgets: [] },
  }))
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expectAgreement()
})

// Settings.theme is now a ThemeState with a 'system' mode, and a fresh or
// unsalvageable payload defaults to it (see defaultThemeState in
// storage.ts) - but this script still only knows 'dark' or nothing, so it
// cannot yet represent that default at all. It guesses light unconditionally
// for these cases, which is only sometimes right once mode can be 'system'.
// That gap is exactly what the next commit's full pre-paint rewrite closes;
// these four cases are pinned to the script's current, narrower behavior
// rather than to full agreement until then.
test('falls back to no dataset.theme when storage holds unparseable JSON', () => {
  localStorage.setItem(STORAGE_KEY, '{not json')
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(loadData().settings.theme.mode).toBe('system')
})

test('falls back to no dataset.theme when storage holds valid JSON that is not an object at all', () => {
  localStorage.setItem(STORAGE_KEY, '[1,2,3]')
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(loadData().settings.theme.mode).toBe('system')
})

test('falls back to no dataset.theme when there is nothing in storage at all', () => {
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(loadData().settings.theme.mode).toBe('system')
})

test('falls back to no dataset.theme when the theme value itself is invalid', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'sepia', enabledWidgets: [] },
  }))
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBeUndefined()
  expect(loadData().settings.theme.mode).toBe('system')
})
