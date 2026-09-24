import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { actions, getData } from '../store'
import { defaultData, STORAGE_KEY } from '../storage'
import type { AppData } from '../types'

/**
 * Two tabs of the app on one device - the owner's shift brief of 2026-09-25,
 * stage 7. Each tab keeps the plan in memory and saves it whole, so a tab
 * left open behind another saved its older copy over the other's next
 * change. The browser tells a tab when another one saved (the `storage`
 * event, never in the tab that wrote); these tests say it the way the
 * browser does, with the other tab's text. Every title is invented.
 */

const DAY = '2030-01-07'

function plan(): AppData {
  const data = defaultData()
  data.days[DAY] = {
    date: DAY,
    tasks: [
      { id: 'a', title: 'Call the bank', done: false, updatedAt: '2030-01-07T08:00:00.000Z' },
      { id: 'b', title: 'Water the plants', done: false, updatedAt: '2030-01-07T08:00:00.000Z' },
    ],
  }
  return data
}

/** What the other tab saves, and the browser hands this one. */
function otherTabSaves(data: AppData, key = STORAGE_KEY): void {
  const text = JSON.stringify(data)
  localStorage.setItem(key, text)
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: text }))
}

const stored = (): AppData => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as AppData
const task = (data: AppData, id: string) => data.days[DAY].tasks.find(t => t.id === id)!

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2030, 0, 7, 9, 0))
  actions.resetForTests(plan())
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()))
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('another tab saves the plan', () => {
  test("a tick made in the other tab is taken in, and this tab's next change does not write over it", () => {
    // The other tab ticks the bank a minute later.
    const theirs = plan()
    theirs.days[DAY].tasks[0] = { ...theirs.days[DAY].tasks[0], done: true, updatedAt: '2030-01-07T09:01:00.000Z' }
    otherTabSaves(theirs)
    expect(task(getData(), 'a').done).toBe(true)

    // This tab, behind it until now, ticks the plants.
    vi.setSystemTime(new Date(2030, 0, 7, 9, 2))
    actions.toggleTask(DAY, 'b')
    expect([task(stored(), 'a').done, task(stored(), 'b').done]).toEqual([true, true])
  })

  test('a change this tab made that the other copy lacks is written back, so neither is lost', () => {
    // This tab ticks the plants and saves; the other tab, which had not seen
    // that yet, ticks the bank and saves its copy over it.
    vi.setSystemTime(new Date(2030, 0, 7, 9, 1))
    actions.toggleTask(DAY, 'b')
    const theirs = plan()
    theirs.days[DAY].tasks[0] = { ...theirs.days[DAY].tasks[0], done: true, updatedAt: '2030-01-07T09:02:00.000Z' }
    otherTabSaves(theirs)
    expect([task(getData(), 'a').done, task(getData(), 'b').done]).toEqual([true, true])
    expect([task(stored(), 'a').done, task(stored(), 'b').done]).toEqual([true, true])
  })

  test('a copy with nothing this tab lacks is taken in and not written again', () => {
    const theirs = plan()
    theirs.days[DAY].tasks[0] = { ...theirs.days[DAY].tasks[0], done: true, updatedAt: '2030-01-07T09:01:00.000Z' }
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const text = JSON.stringify(theirs)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: text }))
    expect(task(getData(), 'a').done).toBe(true)
    expect(setItem).not.toHaveBeenCalled()
  })

  test("a write to another key, or one that does not read as a plan, is not this tab's plan", () => {
    const before = getData()
    const theirs = plan()
    theirs.days[DAY].tasks[0] = { ...theirs.days[DAY].tasks[0], done: true, updatedAt: '2030-01-07T09:01:00.000Z' }
    window.dispatchEvent(new StorageEvent('storage', { key: 'dienius:demo', newValue: JSON.stringify(theirs) }))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '{ not a plan' }))
    expect(getData()).toBe(before)
  })
})

describe('another tab erases this device', () => {
  test('this tab follows it afresh rather than keeping the plan to write back with its next save', async () => {
    const { setReloadForTests } = await import('./core')
    const reload = vi.fn()
    setReloadForTests(reload)
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: null }))
    expect(reload).toHaveBeenCalledTimes(1)
    // And, until it has, it writes nothing back over the erase.
    actions.toggleTask(DAY, 'a')
    expect(setItem.mock.calls.filter(([key]) => key === STORAGE_KEY)).toEqual([])
    setReloadForTests(null)
  })

  test('a storage cleared whole is an erase too; another key taken away is not', async () => {
    const { setReloadForTests } = await import('./core')
    const reload = vi.fn()
    setReloadForTests(reload)
    window.dispatchEvent(new StorageEvent('storage', { key: 'dienius:quick-add-duration', newValue: null }))
    expect(reload).not.toHaveBeenCalled()
    window.dispatchEvent(new StorageEvent('storage', { key: null, newValue: null }))
    expect(reload).toHaveBeenCalledTimes(1)
    setReloadForTests(null)
  })
})
