import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, expect, test } from 'vitest'
import { loadData, STORAGE_KEY } from './lib/storage'
import { applyResolvedTheme, CSS_VAR_NAMES, resolveTheme, systemPrefersDark, TOKEN_KEYS } from './lib/theme'

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
  document.documentElement.removeAttribute('style')
  delete document.documentElement.dataset.theme
  // eslint-disable-next-line no-new-func
  new Function(SCRIPT_SOURCE)()
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('style')
  delete document.documentElement.dataset.theme
})

// Every css custom property the pipeline writes, read back off an element -
// what actually painted, not what a function claims it wrote.
function styleSnapshot(el: HTMLElement): Record<string, string> {
  const snapshot: Record<string, string> = {}
  for (const key of TOKEN_KEYS) snapshot[CSS_VAR_NAMES[key]] = el.style.getPropertyValue(CSS_VAR_NAMES[key])
  snapshot['--rule-h'] = el.style.getPropertyValue('--rule-h')
  snapshot['--rule-v'] = el.style.getPropertyValue('--rule-v')
  snapshot['--safe-ink'] = el.style.getPropertyValue('--safe-ink')
  snapshot['theme'] = el.dataset.theme ?? ''
  return snapshot
}

// The pre-paint script's synchronous, pre-mount guess must produce exactly
// the same token block, on exactly the same element, that the app's own
// resolveTheme + applyResolvedTheme produces from loadData()'s output for
// the same storage. Any difference here is the exact defect this pair of
// tests exists to catch before it ships again: a page that paints one
// theme, then flips to another right after React mounts.
function expectAgreement() {
  const prePaintSnapshot = styleSnapshot(document.documentElement)

  const expected = document.createElement('div')
  applyResolvedTheme(expected, resolveTheme(loadData().settings.theme, systemPrefersDark()))
  const expectedSnapshot = styleSnapshot(expected)

  expect(prePaintSnapshot).toEqual(expectedSnapshot)
}

test('agree on a clean, fully valid dark Slate payload', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: { presetId: 'slate', overrides: {}, mode: 'dark' },
      enabledWidgets: [],
    },
    ifThens: [],
  }))
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expectAgreement()
})

test('agree on a clean, fully valid light Slate payload', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: { presetId: 'slate', overrides: {}, mode: 'light' },
      enabledWidgets: [],
    },
    ifThens: [],
  }))
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBe('light')
  expectAgreement()
})

test('agree on Sketchbook dark with an accent override applied', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: {
        presetId: 'sketchbook',
        overrides: { sketchbook: { accent: '#e0553b' } },
        mode: 'dark',
      },
      enabledWidgets: [],
    },
    ifThens: [],
  }))
  runPrePaintScript()
  expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#e0553b')
  expectAgreement()
})

test('agree on Sketchbook light, and that its ruling actually differs from Slate\'s none', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: { presetId: 'sketchbook', overrides: {}, mode: 'light' },
      enabledWidgets: [],
    },
    ifThens: [],
  }))
  runPrePaintScript()
  expect(document.documentElement.style.getPropertyValue('--rule-v')).not.toBe('transparent')
  expectAgreement()
})

test('a ruleStyle override in the patch is honored and still agrees', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: {
        presetId: 'sketchbook',
        overrides: { sketchbook: { ruleStyle: 'lines' } },
        mode: 'dark',
      },
      enabledWidgets: [],
    },
    ifThens: [],
  }))
  runPrePaintScript()
  expect(document.documentElement.style.getPropertyValue('--rule-v')).toBe('transparent')
  expect(document.documentElement.style.getPropertyValue('--rule-h')).not.toBe('transparent')
  expectAgreement()
})

test('an unknown presetId falls back to Slate and agrees, ignoring overrides keyed to the unknown id', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: {
        presetId: 'not-a-real-preset',
        overrides: { 'not-a-real-preset': { accent: '#ff00ff' } },
        mode: 'light',
      },
      enabledWidgets: [],
    },
    ifThens: [],
  }))
  runPrePaintScript()
  expect(document.documentElement.style.getPropertyValue('--accent')).not.toBe('#ff00ff')
  expectAgreement()
})

// A presetId that happens to name a property every plain object inherits
// from Object.prototype - 'constructor', 'toString', 'valueOf',
// 'hasOwnProperty' - is not merely "unknown" the way 'not-a-real-preset'
// above is. A naive PRESETS[presetId] lookup on an object keyed by id
// returns Object.prototype's own real, truthy value for these names
// instead of undefined, so a preset-lookup guard written as
// `PRESETS[id] ? id : DEFAULT_PRESET_ID` is fooled into treating the
// inherited value as a real preset - then breaks resolving `.modes` off
// it, since Function.prototype has no such property. The outer try/catch
// stops that from crashing the page, but resolution then applies nothing
// at all, leaving :root at the static CSS defaults instead of a fully
// resolved theme - a real regression of the flash this file exists to
// catch, reproduced once already before PRESETS became an array searched
// by id rather than an object indexed by it. Each of these must resolve
// exactly like any other unknown id: fall back to Slate, and still agree.
for (const collidingId of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__']) {
  test(`a presetId of '${collidingId}' cannot be mistaken for a real preset via inherited Object.prototype properties`, () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      templates: [],
      days: {},
      settings: {
        theme: {
          presetId: collidingId,
          overrides: { [collidingId]: { accent: '#ff00ff' } },
          mode: 'dark',
        },
        enabledWidgets: [],
      },
      ifThens: [],
    }))
    runPrePaintScript()
    // Falls back to Slate dark, not an empty or crashed token block.
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#191a1d')
    expect(document.documentElement.style.getPropertyValue('--accent')).not.toBe('#ff00ff')
    expectAgreement()
  })
}

test('agree when the payload has a valid legacy dark theme string but a malformed template elsewhere', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [{}],
    days: {},
    settings: { theme: 'dark', enabledWidgets: [] },
  }))
  runPrePaintScript()
  expect(document.documentElement.dataset.theme).toBe('dark')
  expectAgreement()
})

test('agree when storage holds unparseable JSON', () => {
  localStorage.setItem(STORAGE_KEY, '{not json')
  runPrePaintScript()
  expectAgreement()
})

test('agree when storage holds valid JSON that is not an object at all', () => {
  localStorage.setItem(STORAGE_KEY, '[1,2,3]')
  runPrePaintScript()
  expectAgreement()
})

test('agree when there is nothing in storage at all', () => {
  runPrePaintScript()
  expectAgreement()
})

test('agree when the theme value itself is invalid', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: { theme: 'sepia', enabledWidgets: [] },
  }))
  runPrePaintScript()
  expectAgreement()
})

test('agree when a ThemeState override patch has a non-string value', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: { presetId: 'slate', overrides: { slate: { accent: 123 } }, mode: 'light' },
      enabledWidgets: [],
    },
  }))
  runPrePaintScript()
  expectAgreement()
})

// system mode has nothing stored to disagree about directly - both sides
// read the same live matchMedia result, so this only proves that read is
// wired the same way on both sides, not that it produces the same
// arbitrary value.
test('agrees on --safe-ink, including the broken-theme case where a text override matches the paper exactly', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    templates: [],
    days: {},
    settings: {
      theme: {
        presetId: 'sketchbook',
        overrides: { sketchbook: { text: '#f4ecd8' } },
        mode: 'light',
      },
      enabledWidgets: [],
    },
  }))
  runPrePaintScript()
  // --surface is never one of the four tokens the override panel exposes,
  // so --safe-ink must still be a real, high-contrast ink derived from it -
  // not the broken --text value, and not empty.
  const safeInk = document.documentElement.style.getPropertyValue('--safe-ink')
  expect(['#000000', '#ffffff']).toContain(safeInk)
  expect(safeInk).not.toBe('#f4ecd8')
  expectAgreement()
})

test('agree on system mode following the live OS preference, both directions', () => {
  const original = window.matchMedia
  try {
    for (const prefersDark of [true, false]) {
      window.matchMedia = ((query: string) => ({
        matches: query.includes('dark') ? prefersDark : false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        templates: [],
        days: {},
        settings: { theme: { presetId: 'sketchbook', overrides: {}, mode: 'system' }, enabledWidgets: [] },
      }))
      runPrePaintScript()
      expect(document.documentElement.dataset.theme).toBe(prefersDark ? 'dark' : 'light')
      expectAgreement()
    }
  } finally {
    window.matchMedia = original
  }
})
