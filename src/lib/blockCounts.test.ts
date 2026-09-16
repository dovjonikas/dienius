import { expect, test } from 'vitest'
import { blockCounts, countGroups } from './blockCounts'
import { defaultData } from './storage'
import { addDays } from './dates'
import type { AppData, DayPlan, Task, Template } from './types'

/**
 * How many of the last seven and the last thirty days a repeating block
 * happened on - a count, and nothing else. Every name here is a generic
 * one.
 */

const TODAY = '2026-09-16'

const work: Template = {
  id: 't1',
  name: 'First template',
  color: '#8ab6f9',
  blocks: [
    { id: 'b1', time: '09:00', title: 'First block', minutes: 60 },
    { id: 'b2', time: '12:30', title: 'Second block', minutes: 45 },
    { id: 'b3', title: 'Untimed block' },
  ],
}

function stamped(blockId: string, over: Partial<Task> = {}): Task {
  const block = work.blocks.find(b => b.id === blockId)!
  return {
    id: `${blockId}-${over.done ? 'done' : 'open'}-${Math.random()}`,
    title: block.title,
    time: block.time,
    done: false,
    fromTemplate: true,
    origin: { type: 'template', sourceId: 't1', blockId },
    ...over,
  }
}

function day(date: string, tasks: Task[], templateId = 't1'): DayPlan {
  return { date, templateId, tasks }
}

function withDays(days: DayPlan[], templates: Template[] = [work]): AppData {
  return { ...defaultData(), templates, days: Object.fromEntries(days.map(d => [d.date, d])) }
}

test('a block done on a day counts once for that day, in the seven and in the thirty', () => {
  const data = withDays([
    day(addDays(TODAY, -1), [stamped('b1', { done: true }), stamped('b2')]),
    day(addDays(TODAY, -3), [stamped('b1', { done: true })]),
    day(addDays(TODAY, -10), [stamped('b1', { done: true }), stamped('b2', { done: true })]),
  ])
  const counts = blockCounts(data, TODAY)
  expect(counts.map(c => [c.title, c.last7, c.last30, c.days])).toEqual([
    ['First block', 2, 3, 3],
    ['Second block', 0, 1, 3],
    ['Untimed block', 0, 0, 3],
  ])
})

test('today counts, the thirtieth day back counts, and the day before it does not', () => {
  const data = withDays([
    day(TODAY, [stamped('b1', { done: true })]),
    day(addDays(TODAY, -6), [stamped('b1', { done: true })]),
    day(addDays(TODAY, -7), [stamped('b1', { done: true })]),
    day(addDays(TODAY, -29), [stamped('b1', { done: true })]),
    day(addDays(TODAY, -30), [stamped('b1', { done: true })]),
  ])
  const [first] = blockCounts(data, TODAY)
  expect(first.last7).toBe(2)
  expect(first.last30).toBe(4)
  expect(first.days).toBe(4)
})

test('a day it did not happen changes nothing but the count: there is no streak to lose', () => {
  const steady = withDays([
    day(addDays(TODAY, -1), [stamped('b1', { done: true })]),
    day(addDays(TODAY, -2), [stamped('b1', { done: true })]),
    day(addDays(TODAY, -3), [stamped('b1', { done: true })]),
  ])
  const gap = withDays([
    day(addDays(TODAY, -1), [stamped('b1', { done: true })]),
    day(addDays(TODAY, -2), [stamped('b1')]),
    day(addDays(TODAY, -3), [stamped('b1', { done: true })]),
  ])
  expect(blockCounts(steady, TODAY)[0].last7).toBe(3)
  expect(blockCounts(gap, TODAY)[0].last7).toBe(2)
  expect(Object.keys(blockCounts(gap, TODAY)[0])).toEqual(Object.keys(blockCounts(steady, TODAY)[0]))
})

test('a block that stood on no day in the thirty is not listed, and a day stamped from a template that is gone says nothing', () => {
  const data = withDays([day(addDays(TODAY, -40), [stamped('b1', { done: true })]), day(addDays(TODAY, -2), [], 'gone')])
  expect(blockCounts(data, TODAY)).toEqual([])
})

test('a task from before origins existed still stands for its block, by title and time', () => {
  const data = withDays([
    day(addDays(TODAY, -1), [{ id: 'old', title: 'First block', time: '09:00', done: true, fromTemplate: true }]),
  ])
  expect(blockCounts(data, TODAY).map(c => [c.title, c.last7])).toEqual([
    ['First block', 1],
    ['Second block', 0],
    ['Untimed block', 0],
  ])
})

test('the lines stand in the templates’ order and then the day’s, and group by template', () => {
  const rest: Template = {
    id: 't2',
    name: 'Second template',
    color: '#a7c4f5',
    blocks: [{ id: 'r1', time: '10:00', title: 'Rest block' }],
  }
  const data = withDays(
    [
      day(addDays(TODAY, -1), [{ id: 'r', title: 'Rest block', time: '10:00', done: true, origin: { type: 'template', sourceId: 't2', blockId: 'r1' } }], 't2'),
      day(addDays(TODAY, -2), [stamped('b2', { done: true })]),
    ],
    [work, rest],
  )
  const groups = countGroups(blockCounts(data, TODAY))
  expect(groups.map(g => [g.templateName, g.counts.map(c => c.title)])).toEqual([
    ['First template', ['First block', 'Second block', 'Untimed block']],
    ['Second template', ['Rest block']],
  ])
})
