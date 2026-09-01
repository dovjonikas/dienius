import { expect, test } from 'vitest'
import type { Task } from '../../lib/types'
import { resolveDrop } from './dragDrop'

function float(id: string, minutes?: number, done = false): Task {
  return { id, title: id, done, minutes }
}

function anchor(id: string, time: string, minutes?: number, done = false): Task {
  return { id, title: id, done, time, minutes }
}

test('a float dropped on a gap it fits places it at the gap start', () => {
  const tasks = [float('Guitar', 20)]
  const outcome = resolveDrop(tasks, 'float', 'Guitar', { type: 'gap', startMinutes: 780, gapMinutes: 60 })
  expect(outcome).toEqual({ action: 'place', taskId: 'Guitar', startMinutes: 780 })
})

test('a float exactly the size of the gap still places', () => {
  const tasks = [float('Guitar', 60)]
  const outcome = resolveDrop(tasks, 'float', 'Guitar', { type: 'gap', startMinutes: 780, gapMinutes: 60 })
  expect(outcome).toEqual({ action: 'place', taskId: 'Guitar', startMinutes: 780 })
})

test('an unsized float dropped on any gap still places, same as the tap picker offers it', () => {
  const tasks = [float('Call grandma')]
  const outcome = resolveDrop(tasks, 'float', 'Call grandma', { type: 'gap', startMinutes: 780, gapMinutes: 5 })
  expect(outcome).toEqual({ action: 'place', taskId: 'Call grandma', startMinutes: 780 })
})

test('a float too big for the gap is refused - nothing happens', () => {
  const tasks = [float('Deep work', 300)]
  const outcome = resolveDrop(tasks, 'float', 'Deep work', { type: 'gap', startMinutes: 780, gapMinutes: 60 })
  expect(outcome).toEqual({ action: 'none' })
})

test('a float dropped on the tray (not a gap) is a no-op - it is already there', () => {
  const tasks = [float('Guitar', 20)]
  const outcome = resolveDrop(tasks, 'float', 'Guitar', { type: 'tray' })
  expect(outcome).toEqual({ action: 'none' })
})

test('a float dropped nowhere identifiable leaves state untouched', () => {
  const tasks = [float('Guitar', 20)]
  const outcome = resolveDrop(tasks, 'float', 'Guitar', null)
  expect(outcome).toEqual({ action: 'none' })
})

test('a done float is never placeable, even dragged onto a gap it would fit', () => {
  const tasks = [float('Guitar', 20, true)]
  const outcome = resolveDrop(tasks, 'float', 'Guitar', { type: 'gap', startMinutes: 780, gapMinutes: 60 })
  expect(outcome).toEqual({ action: 'none' })
})

test('an anchor dropped on the tray un-anchors it', () => {
  const tasks = [anchor('Shift', '09:00', 240)]
  const outcome = resolveDrop(tasks, 'anchor', 'Shift', { type: 'tray' })
  expect(outcome).toEqual({ action: 'unanchor', taskId: 'Shift' })
})

test('an anchor dropped on a gap is refused - re-timing an anchor is not what this drag does', () => {
  const tasks = [anchor('Shift', '09:00', 240)]
  const outcome = resolveDrop(tasks, 'anchor', 'Shift', { type: 'gap', startMinutes: 780, gapMinutes: 60 })
  expect(outcome).toEqual({ action: 'none' })
})

test('an anchor dropped nowhere identifiable leaves state untouched', () => {
  const tasks = [anchor('Shift', '09:00', 240)]
  const outcome = resolveDrop(tasks, 'anchor', 'Shift', null)
  expect(outcome).toEqual({ action: 'none' })
})

test('a done anchor is never un-anchored by drag, matching the list row which offers no control for it', () => {
  const tasks = [anchor('Shift', '09:00', 240, true)]
  const outcome = resolveDrop(tasks, 'anchor', 'Shift', { type: 'tray' })
  expect(outcome).toEqual({ action: 'none' })
})

test('a task id that does not exist on the day resolves to nothing, not a throw', () => {
  const outcome = resolveDrop([], 'float', 'ghost', { type: 'gap', startMinutes: 780, gapMinutes: 60 })
  expect(outcome).toEqual({ action: 'none' })
})

test('dragging a float that is somehow already an anchor is refused, matching placeFloat\'s own guard', () => {
  const tasks = [anchor('Weird', '09:00', 30)]
  const outcome = resolveDrop(tasks, 'float', 'Weird', { type: 'gap', startMinutes: 780, gapMinutes: 60 })
  expect(outcome).toEqual({ action: 'none' })
})

test('dragging an anchor that is somehow actually a float is refused, matching unanchorTask\'s own guard', () => {
  const tasks = [float('Weird', 30)]
  const outcome = resolveDrop(tasks, 'anchor', 'Weird', { type: 'tray' })
  expect(outcome).toEqual({ action: 'none' })
})
