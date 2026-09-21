import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData } from './storage'
import { rosterPreview } from './rosterPreview'
import type { AppData, Routine, Template } from './types'

/**
 * What applying a roster would do, said before it is done - rotating shifts,
 * v2.29 stage 7, and docs/RESEARCH-SHIFTS.md section 6.1. Week by week: each
 * date's letter, and under the week how many routines have no time, how many
 * run into something, and how many days were changed by hand. A date whose
 * kind and composition do not change is counted and not listed.
 *
 * Wednesday 2026-09-16 is "today" throughout, which is the day the rest of
 * this suite pins. Every name here is a generic one.
 */

const TODAY = '2026-09-16'

const KIND = (id: string, name: string, letter: string, order: number, blocks: Template['blocks'] = []): Template =>
  ({ id, name, color: '#a7c4f5', blocks, dayKind: { letter, order } }) as Template

const ROUTINE = (over: Partial<Routine> = {}): Routine =>
  ({ id: 'gym', title: 'Training', minutes: 60, weekdays: [0, 1, 2, 3, 4, 5, 6], times: {}, ...over }) as Routine

function plan(over: Partial<AppData> = {}): AppData {
  const data = defaultData()
  data.templates = [
    KIND('day', 'Day shift', 'D', 0, [{ id: 'shift', title: 'On shift', time: '07:00', minutes: 720, category: 'core' }]),
    KIND('rest', 'Rest day', 'R', 1),
  ]
  return { ...data, ...over }
}

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(plan())
})

test('a preview is the dates week by week, with the letter each one would get', () => {
  const preview = rosterPreview(getData(), { '2026-09-17': 'day', '2026-09-18': 'rest', '2026-09-21': 'day' }, TODAY)

  expect(preview.weeks.map(w => w.from)).toEqual(['2026-09-14', '2026-09-21'])
  expect(preview.weeks[0].dates.map(d => [d.date, d.letter])).toEqual([
    ['2026-09-17', 'D'],
    ['2026-09-18', 'R'],
  ])
  expect(preview.weeks[1].dates.map(d => [d.date, d.letter])).toEqual([['2026-09-21', 'D']])
  expect(preview.changing).toBe(3)
})

test('a date behind today is not in the preview at all, and neither is a kind that is no longer one', () => {
  const preview = rosterPreview(getData(), { '2026-09-15': 'day', '2026-09-17': 'gone', '2026-09-18': 'day' }, TODAY)
  expect(preview.weeks.flatMap(w => w.dates).map(d => d.date)).toEqual(['2026-09-18'])
})

test('a date the roster would not change is counted and not listed', () => {
  actions.resetForTests(plan({ days: { '2026-09-17': { date: '2026-09-17', templateId: 'rest', tasks: [] } } }))
  const preview = rosterPreview(getData(), { '2026-09-17': 'rest', '2026-09-18': 'rest' }, TODAY)

  expect(preview.weeks.flatMap(w => w.dates).map(d => d.date)).toEqual(['2026-09-18'])
  expect(preview.unchanged).toBe(1)
  expect(preview.changing).toBe(1)
})

test('a week says how many routines have no time on it, and how many run into something', () => {
  actions.resetForTests(plan({ routines: [ROUTINE({ times: { rest: '09:00' } }), ROUTINE({ id: 'walk', title: 'Walk', minutes: 30, times: { day: '09:00' } })] }))
  const preview = rosterPreview(getData(), { '2026-09-17': 'day' }, TODAY)

  const week = preview.weeks[0]
  // Training has no time on a day shift; Walk has one, at nine, which is
  // inside the shift itself.
  expect(week.needsTime).toBe(1)
  expect(week.runsInto).toBe(1)
  expect(week.dates[0].needsTime).toBe(1)
  expect(week.dates[0].runsInto).toBe(1)
})

test('a date changed by hand says what was changed, and only where it is changing', () => {
  actions.resetForTests(
    plan({
      days: {
        '2026-09-17': {
          date: '2026-09-17',
          templateId: 'day',
          tasks: [
            {
              id: 't1',
              title: 'On shift',
              time: '07:00',
              minutes: 720,
              done: true,
              category: 'core',
              origin: { type: 'template', sourceId: 'day', blockId: 'shift' },
              fromBlock: { title: 'On shift', time: '07:00', minutes: 720, category: 'core' },
            },
            { id: 't2', title: 'Something of my own', minutes: 30, done: false },
          ],
        },
      },
    }),
  )
  const preview = rosterPreview(getData(), { '2026-09-17': 'rest' }, TODAY)

  const date = preview.weeks[0].dates[0]
  expect(date.hand).toMatchObject({ done: 1 })
  expect(preview.weeks[0].handEdited).toBe(1)
  // What was written by hand is not counted: it stays through any stamp.
  expect(date.hand!.deleted).toBe(0)
})
