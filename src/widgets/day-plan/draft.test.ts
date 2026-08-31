import { beforeEach, expect, test } from 'vitest'
import { clearDraft, consumeDraft, saveDraft } from './draft'

beforeEach(() => {
  sessionStorage.clear()
})

test('consumeDraft returns what was saved for that date', () => {
  saveDraft('2026-08-31', 'buy milk')
  expect(consumeDraft('2026-08-31')).toBe('buy milk')
})

test('consumeDraft only returns it once', () => {
  saveDraft('2026-08-31', 'buy milk')
  consumeDraft('2026-08-31')
  expect(consumeDraft('2026-08-31')).toBe('')
})

test('consumeDraft does not return a draft saved for a different date', () => {
  saveDraft('2026-08-31', 'buy milk')
  expect(consumeDraft('2026-09-01')).toBe('')
})

test('consumeDraft returns empty when nothing was saved', () => {
  expect(consumeDraft('2026-08-31')).toBe('')
})

test('saving an empty string clears any existing draft', () => {
  saveDraft('2026-08-31', 'buy milk')
  saveDraft('2026-08-31', '')
  expect(consumeDraft('2026-08-31')).toBe('')
})

test('clearDraft removes a saved draft outright', () => {
  saveDraft('2026-08-31', 'buy milk')
  clearDraft()
  expect(consumeDraft('2026-08-31')).toBe('')
})

test('a later save for the same date overwrites the earlier one', () => {
  saveDraft('2026-08-31', 'buy milk')
  saveDraft('2026-08-31', 'buy milk and eggs')
  expect(consumeDraft('2026-08-31')).toBe('buy milk and eggs')
})
