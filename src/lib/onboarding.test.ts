import { expect, test } from 'vitest'
import { isFirstRun } from './onboarding'
import { defaultData } from './storage'
import type { AppData } from './types'

test('a fresh install with no templates and no days is a first run', () => {
  expect(isFirstRun(defaultData())).toBe(true)
})

test('any template at all ends the first run, even with no days touched', () => {
  const data: AppData = defaultData()
  data.templates.push({ id: 't1', name: 'Working day', color: '#a7c4f5', blocks: [] })
  expect(isFirstRun(data)).toBe(false)
})

test('a day holding a real task ends the first run, even with no templates', () => {
  const data: AppData = defaultData()
  data.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 'x1', title: 'Call mom', done: false }],
  }
  expect(isFirstRun(data)).toBe(false)
})

test('a day entry with an empty task list does not by itself end the first run', () => {
  // applyStamps and other code paths can leave a DayPlan record with no
  // tasks at all - an erased stamp, a day visited but never touched. That
  // should read exactly like no entry existing, not like real work.
  const data: AppData = defaultData()
  data.days['2026-09-01'] = { date: '2026-09-01', tasks: [] }
  expect(isFirstRun(data)).toBe(true)
})

test('deleting everything through Settings restores the first run, no flag involved', () => {
  const data: AppData = defaultData()
  data.templates.push({ id: 't1', name: 'Working day', color: '#a7c4f5', blocks: [] })
  data.days['2026-09-01'] = {
    date: '2026-09-01',
    tasks: [{ id: 'x1', title: 'Call mom', done: false }],
  }
  expect(isFirstRun(data)).toBe(false)
  // A reset writes defaultData() straight back into storage - see
  // SettingsView.tsx's handleResetClick - so there is nothing left to
  // "un-set"; the very next read is a fresh, first-run AppData again.
  expect(isFirstRun(defaultData())).toBe(true)
})
