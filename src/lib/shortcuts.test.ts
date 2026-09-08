import { expect, test } from 'vitest'
import { SHORTCUTS, isTypingTarget, shortcutKeyFor } from './shortcuts'

function key(init: Partial<KeyboardEvent> & { key: string }, target?: EventTarget): KeyboardEvent {
  const e = new KeyboardEvent('keydown', init)
  if (target) Object.defineProperty(e, 'target', { value: target })
  return e
}

function field(tag: 'input' | 'textarea' | 'select' = 'input'): HTMLElement {
  return document.createElement(tag)
}

// --- the card and the handler cannot drift -------------------------------

test('every shortcut has a label and a description - one cannot exist without the other', () => {
  for (const s of SHORTCUTS) {
    expect(s.key).not.toBe('')
    expect(s.label).not.toBe('')
    expect(s.description).not.toBe('')
  }
})

test('no key is listed twice', () => {
  expect(new Set(SHORTCUTS.map(s => s.key)).size).toBe(SHORTCUTS.length)
})

/**
 * The arrows move the day and nothing else: App's handler returns without
 * acting anywhere but the day view. A row that said only "the day before"
 * promised the calendar and the library something the app has never done, so
 * the row says where it works.
 */
test('the arrow rows name the view they work on', () => {
  expect(SHORTCUTS.find(s => s.key === 'arrowleft')!.description).toBe('The day before, on the day view')
  expect(SHORTCUTS.find(s => s.key === 'arrowright')!.description).toBe('The day after, on the day view')
})

/**
 * Two keys open Scratch and the card named one of them, which made the
 * backtick a feature nobody had - CONVENTIONS section 17. The row names both.
 */
test('the Scratch row names both keys that open it', () => {
  const scratch = SHORTCUTS.find(s => s.key === 's')!
  expect(scratch.label).toContain('S')
  expect(scratch.label).toContain('`')
})

/** The rail's Today button and the palette both land on today; so does the key. */
test('the row for 1 says Today, which is the day it opens', () => {
  expect(SHORTCUTS.find(s => s.key === '1')!.description).toBe('Today')
})

// --- rule one: a bare letter never fires while a field has focus ---------

test('a field, a textarea and a select are all typing targets', () => {
  expect(isTypingTarget(field('input'))).toBe(true)
  expect(isTypingTarget(field('textarea'))).toBe(true)
  expect(isTypingTarget(field('select'))).toBe(true)
})

test('an ordinary element is not', () => {
  expect(isTypingTarget(document.createElement('div'))).toBe(false)
  expect(isTypingTarget(null)).toBe(false)
})

test('anything inside a widget that keeps its own keys is a typing target too', () => {
  const host = document.createElement('div')
  host.setAttribute('data-keeps-keys', '')
  const inner = document.createElement('button')
  host.appendChild(inner)
  document.body.appendChild(host)
  expect(isTypingTarget(inner)).toBe(true)
  host.remove()
})

test('n while a field has focus is an n, not a command', () => {
  expect(shortcutKeyFor(key({ key: 'n' }, field()))).toBeNull()
  expect(shortcutKeyFor(key({ key: 'n' }, document.createElement('div')))).toBe('n')
})

// --- rule two: Escape always fires --------------------------------------

test('Escape fires from inside a field, because leaving the field is the point', () => {
  expect(shortcutKeyFor(key({ key: 'Escape' }, field()))).toBe('escape')
})

test('Escape fires even while a key is held down', () => {
  expect(shortcutKeyFor(key({ key: 'Escape', repeat: true }, field()))).toBe('escape')
})

// --- modifiers belong to the browser ------------------------------------

test('a modifier chord is never ours', () => {
  for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
    expect(shortcutKeyFor(key({ key: 'n', [mod]: true }))).toBeNull()
  }
})

test('Shift is allowed only for the question mark, which is a shifted key', () => {
  expect(shortcutKeyFor(key({ key: '?', shiftKey: true }))).toBe('?')
  expect(shortcutKeyFor(key({ key: 'N', shiftKey: true }))).toBeNull()
})

// A held key would fire a command per repeat, which for "push a day" means
// travelling a week by accident.
test('a repeated key does not fire again', () => {
  expect(shortcutKeyFor(key({ key: 'arrowright', repeat: true }))).toBeNull()
})

test('keys are matched case-insensitively, so caps lock is not a different app', () => {
  expect(shortcutKeyFor(key({ key: 'T' }))).toBe('t')
  expect(shortcutKeyFor(key({ key: 'ArrowLeft' }))).toBe('arrowleft')
})
