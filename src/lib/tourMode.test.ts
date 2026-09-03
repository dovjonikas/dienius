import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { TOUR_STORAGE_KEY, isTourSandbox, setTourSandboxForTests } from './tourMode'
import { STORAGE_KEY, defaultData, loadData, saveData } from './storage'
import { actions, getData } from './store'
import { resetTourForTests, startTour, endTour } from './tourState'
import { snapshotToday } from './snapshots'
import { resetSyncForTests, setSyncConfig, syncNow } from './syncClient'

beforeEach(() => {
  localStorage.clear()
  setTourSandboxForTests(false)
  resetTourForTests()
  actions.resetForTests(defaultData())
})

afterEach(() => {
  setTourSandboxForTests(false)
  resetSyncForTests()
  vi.restoreAllMocks()
})

/**
 * A replay of the tour runs in a sandbox: its own storage key, an empty app,
 * thrown away afterwards. The isolation is the feature - somebody with a year
 * of days must be able to press "Replay tour" without the tour stamping a
 * starter template onto their Tuesday.
 */

test('the sandbox reads and writes its own key, never the real one', () => {
  const real = defaultData()
  real.templates.push({ id: 'mine', name: 'Mine', color: '#fff', blocks: [] })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(real))

  setTourSandboxForTests(true)
  expect(isTourSandbox()).toBe(true)
  const sandbox = loadData()
  expect(sandbox.templates).toEqual([])

  sandbox.templates.push({ id: 'tour', name: 'Tour', color: '#fff', blocks: [] })
  saveData(sandbox)
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).templates.map((t: { id: string }) => t.id)).toEqual(['mine'])
  expect(JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY)!).templates.map((t: { id: string }) => t.id)).toEqual(['tour'])
})

// The sandbox is an empty app, but it is *this person's* empty app: the tour
// should look like the app they came from, not like a fresh install.
test('an empty sandbox opens with the real plan\'s theme', () => {
  const real = defaultData()
  real.settings.theme = { presetId: 'light', overrides: {}, mode: 'light' }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(real))
  setTourSandboxForTests(true)
  expect(loadData().settings.theme.presetId).toBe('light')
})

test('nothing in the sandbox is ever synced', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'))
  setSyncConfig({ url: 'https://example.test', token: 't', enabled: true })
  fetchSpy.mockClear()
  setTourSandboxForTests(true)
  await syncNow()
  expect(fetchSpy).not.toHaveBeenCalled()
})

test('nothing in the sandbox is ever snapshotted', async () => {
  setTourSandboxForTests(true)
  expect(await snapshotToday(defaultData(), '2026-09-03')).toBe(false)
})

/**
 * On a real plan the tour flags what it creates, by diffing in commit() -
 * no action has to know the tour exists. Off, the same actions flag nothing.
 */
test('while the tour runs, commit flags what appeared; when it is over, it stops', () => {
  startTour('desktop')
  actions.addTask('2026-09-03', 'During')
  const template = actions.addTemplate({ name: 'During', color: '#fff', blocks: [] })
  endTour()
  actions.addTask('2026-09-03', 'After')

  const tasks = getData().days['2026-09-03'].tasks
  expect(tasks.find(t => t.title === 'During')?.tourCreated).toBe(true)
  expect(tasks.find(t => t.title === 'After')?.tourCreated).toBeUndefined()
  expect(getData().templates.find(t => t.id === template.id)?.tourCreated).toBe(true)
})

test('a flagged task survives a save and a load, and validates', () => {
  startTour('desktop')
  actions.addTask('2026-09-03', 'During')
  endTour()
  const loaded = loadData()
  expect(loaded.days['2026-09-03'].tasks[0].tourCreated).toBe(true)
})
