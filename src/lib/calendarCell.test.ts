import { expect, test } from 'vitest'
import { cellLabel, resolveTemplate, taskState } from './calendarCell'
import type { MonthCell } from './dates'
import type { Template } from './types'

// taskState - moved unchanged from CalendarView.tsx. A cell built only from
// templateId cannot tell a genuinely empty day apart from one that holds
// real, unstamped tasks.

test('taskState reports none for an undefined day', () => {
  expect(taskState(undefined)).toBe('none')
})

test('taskState reports none for a day with zero tasks', () => {
  expect(taskState({ tasks: [] })).toBe('none')
})

test('taskState reports unfinished when at least one task is not done', () => {
  expect(taskState({ tasks: [{ done: true }, { done: false }] })).toBe('unfinished')
})

test('taskState reports done only when every task is done', () => {
  expect(taskState({ tasks: [{ done: true }, { done: true }] })).toBe('done')
})

// resolveTemplate - the template-lookup logic, extracted so MiniCalendar can
// share it without re-deriving the same rules or depending on
// CalendarView's own staged-paint state.

const templates: Template[] = [
  { id: 't1', name: 'Work', color: '#8ab6f9', blocks: [] },
  { id: 't2', name: 'Rest', color: '#cde39e', blocks: [] },
]

test('resolveTemplate finds the template by id', () => {
  expect(resolveTemplate('t2', templates)?.name).toBe('Rest')
})

test('resolveTemplate returns undefined for null, undefined, or an unknown id', () => {
  expect(resolveTemplate(null, templates)).toBeUndefined()
  expect(resolveTemplate(undefined, templates)).toBeUndefined()
  expect(resolveTemplate('missing', templates)).toBeUndefined()
})

// cellLabel - the accessible name a screen reader gets for one cell,
// carrying the full date, the template name, and unfinished/done state,
// none of which is left to color alone.

const cell: MonthCell = { key: '2026-09-12', inMonth: true }

test('cellLabel always includes the full formatted date', () => {
  expect(cellLabel(cell, undefined, 'none')).toBe('Saturday, September 12')
})

test('cellLabel appends the template name when one is stamped', () => {
  expect(cellLabel(cell, 'Work', 'none')).toBe('Saturday, September 12, Work')
})

test('cellLabel appends "has unfinished tasks" for an unfinished day', () => {
  expect(cellLabel(cell, undefined, 'unfinished')).toBe('Saturday, September 12, has unfinished tasks')
})

test('cellLabel appends "tasks completed" for a fully done day', () => {
  expect(cellLabel(cell, undefined, 'done')).toBe('Saturday, September 12, tasks completed')
})

test('cellLabel combines template name and task state together', () => {
  expect(cellLabel(cell, 'Work', 'done')).toBe('Saturday, September 12, Work, tasks completed')
})
