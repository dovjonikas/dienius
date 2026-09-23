import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { defaultData, loadData, saveData, STORAGE_KEY } from './storage'
import { forgetUnreadable, resetUnreadableForTests, unreadablePlan, UNREADABLE_KEY } from './unreadable'
import { setTourSandboxForTests } from './tourMode'

/**
 * A plan this browser cannot read is kept, and never written over unseen -
 * see unreadable.ts. Before the freeze it opened as an empty app without a
 * word, and the first save put the empty plan where the month had been.
 */

beforeEach(() => {
  localStorage.clear()
  resetUnreadableForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  setTourSandboxForTests(false)
})

const kept = () => JSON.parse(localStorage.getItem(UNREADABLE_KEY) ?? 'null') as { keptAt: string; text: string } | null

test('a stored plan that is not JSON is kept aside as it was, and a save afterwards does not touch the copy', () => {
  localStorage.setItem(STORAGE_KEY, '{"templates": [ a byte went wrong')
  const data = loadData()
  expect(data).toEqual(defaultData())
  expect(kept()?.text).toBe('{"templates": [ a byte went wrong')
  expect(saveData(data)).toBe(true)
  expect(kept()?.text).toBe('{"templates": [ a byte went wrong')
})

test('a stored plan the guard refuses is kept aside too', () => {
  const refused = JSON.stringify({ templates: 'not a list', days: {}, settings: {} })
  localStorage.setItem(STORAGE_KEY, refused)
  loadData()
  expect(kept()?.text).toBe(refused)
  expect(unreadablePlan()?.text).toBe(refused)
})

test('found again on the next open, it keeps the time it was first found', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 23, 9, 0))
  localStorage.setItem(STORAGE_KEY, 'not a plan')
  loadData()
  const first = kept()?.keptAt
  vi.setSystemTime(new Date(2026, 8, 24, 9, 0))
  loadData()
  expect(kept()?.keptAt).toBe(first)
})

test('a plan that reads keeps nothing aside', () => {
  saveData(defaultData())
  loadData()
  expect(localStorage.getItem(UNREADABLE_KEY)).toBeNull()
  expect(unreadablePlan()).toBeNull()
})

test('the tour keeps nothing aside: its sandbox is thrown away by design', () => {
  setTourSandboxForTests(true)
  localStorage.setItem('dienius:tour', 'not a plan')
  loadData()
  expect(localStorage.getItem(UNREADABLE_KEY)).toBeNull()
})

test('where the copy cannot be written, nothing is saved over the plan until it is forgotten', () => {
  localStorage.setItem(STORAGE_KEY, 'not a plan')
  const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
  })
  loadData()
  setItem.mockRestore()
  expect(unreadablePlan()).toMatchObject({ text: 'not a plan', held: true })
  expect(saveData(defaultData())).toBe(false)
  expect(localStorage.getItem(STORAGE_KEY)).toBe('not a plan')
  forgetUnreadable()
  expect(saveData(defaultData())).toBe(true)
  expect(localStorage.getItem(STORAGE_KEY)).not.toBe('not a plan')
})

test('forgotten, it is gone', () => {
  localStorage.setItem(STORAGE_KEY, 'not a plan')
  loadData()
  forgetUnreadable()
  expect(localStorage.getItem(UNREADABLE_KEY)).toBeNull()
  expect(unreadablePlan()).toBeNull()
})
