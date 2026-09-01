import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { resolveDrop } from './dragDrop'

function float(id: string, minutes?: number, done = false): Task {
  return { id, title: id, done, minutes }
}

function anchor(id: string, time: string, minutes?: number, done = false): Task {
  return { id, title: id, done, time, minutes }
}

test('an anchor dropped on the tray un-anchors it', () => {
  const tasks = [anchor('Shift', '09:00', 240)]
  const outcome = resolveDrop(tasks, 'Shift', { type: 'tray' })
  expect(outcome).toEqual({ action: 'unanchor', taskId: 'Shift' })
})

test('an anchor dropped nowhere identifiable leaves state untouched', () => {
  const tasks = [anchor('Shift', '09:00', 240)]
  const outcome = resolveDrop(tasks, 'Shift', null)
  expect(outcome).toEqual({ action: 'none' })
})

test('a done anchor is never un-anchored by drag, matching the list row which offers no control for it', () => {
  const tasks = [anchor('Shift', '09:00', 240, true)]
  const outcome = resolveDrop(tasks, 'Shift', { type: 'tray' })
  expect(outcome).toEqual({ action: 'none' })
})

test('a task id that does not exist on the day resolves to nothing, not a throw', () => {
  const outcome = resolveDrop([], 'ghost', { type: 'tray' })
  expect(outcome).toEqual({ action: 'none' })
})

test('dragging a float (it should never start a drag, but the guard is still checked) is refused', () => {
  const tasks = [float('Weird', 30)]
  const outcome = resolveDrop(tasks, 'Weird', { type: 'tray' })
  expect(outcome).toEqual({ action: 'none' })
})
