import { expect, test } from 'vitest'
import { foldLegacySteps, foldStepsIntoNote, stepLine } from './stepsToNote'
import { defaultData, exportJson, importJson } from './storage'

// The one-way door out of steps. Nothing is lost, and it runs twice safely -
// which matters because it runs on every load and on every import.

test('a step becomes the line somebody would have typed', () => {
  expect(stepLine({ title: 'Water' })).toBe('- Water')
  expect(stepLine({ title: 'Meditation', minutes: 10 })).toBe('- Meditation (10 min)')
  expect(stepLine({ title: '  Light  ' })).toBe('- Light')
  expect(stepLine({ title: '' })).toBeNull()
  expect(stepLine({})).toBeNull()
})

test('a list with no note becomes the note', () => {
  expect(foldStepsIntoNote(undefined, [{ title: 'Water' }, { title: 'Light' }])).toBe('- Water\n- Light')
})

test('a note and a list keep both, with a blank line between them', () => {
  expect(foldStepsIntoNote('Slow first, then to tempo.', [{ title: 'Warm up', minutes: 5 }])).toBe(
    'Slow first, then to tempo.\n\n- Warm up (5 min)',
  )
})

test('nothing to fold leaves the note exactly as it was', () => {
  expect(foldStepsIntoNote('Rice and chicken', [])).toBe('Rice and chicken')
  expect(foldStepsIntoNote('Rice and chicken', undefined)).toBe('Rice and chicken')
  expect(foldStepsIntoNote(undefined, [])).toBeUndefined()
})

test('a line already in the note is not added a second time', () => {
  // The real guard. A file that was migrated, exported and imported comes
  // back the same rather than doubled - and so does a half-migrated one.
  const once = foldStepsIntoNote(undefined, [{ title: 'Water' }, { title: 'Light' }])
  expect(foldStepsIntoNote(once, [{ title: 'Water' }, { title: 'Light' }])).toBe(once)
  // And a list where one is new keeps only the new one.
  expect(foldStepsIntoNote(once, [{ title: 'Water' }, { title: 'Out of the room' }])).toBe(
    '- Water\n- Light\n\n- Out of the room',
  )
})

test('a whole payload folds its tasks, its blocks and its Later', () => {
  const before = {
    days: {
      '2026-09-01': {
        date: '2026-09-01',
        tasks: [{ id: 't', title: 'Morning', note: 'Slowly', subtasks: [{ id: 's', title: 'Water', done: true }] }],
      },
    },
    templates: [{ id: 'x', blocks: [{ id: 'b', title: 'Routine', steps: [{ id: 's', title: 'Light', minutes: 5 }] }] }],
    backlog: [{ id: 'l', title: 'Later one', subtasks: [{ id: 's', title: 'A step' }] }],
  }
  const after = foldLegacySteps(before) as typeof before & {
    days: Record<string, { tasks: Record<string, unknown>[] }>
    templates: { blocks: Record<string, unknown>[] }[]
    backlog: Record<string, unknown>[]
  }

  const task = after.days['2026-09-01'].tasks[0]
  expect(task.note).toBe('Slowly\n\n- Water')
  expect('subtasks' in task).toBe(false)

  const block = after.templates[0].blocks[0]
  expect(block.note).toBe('- Light (5 min)')
  expect('steps' in block).toBe(false)

  expect(after.backlog[0].note).toBe('- A step')
  expect('subtasks' in after.backlog[0]).toBe(false)
})

test('a payload with no steps anywhere comes back unchanged', () => {
  const before = { days: { d: { date: 'd', tasks: [{ id: 't', title: 'X', note: 'unchanged' }] } }, templates: [] }
  const after = foldLegacySteps(before) as typeof before
  expect(after.days.d.tasks[0]).toEqual({ id: 't', title: 'X', note: 'unchanged' })
})

test('a backup written with steps imports whole, and imports twice the same', () => {
  const data = defaultData()
  const withSteps = JSON.parse(exportJson(data))
  withSteps.days = {
    '2026-09-01': {
      date: '2026-09-01',
      tasks: [
        {
          id: 't1',
          title: 'Morning routine',
          done: false,
          note: 'Before anything else.',
          subtasks: [
            { id: 's1', title: 'Water', done: true },
            { id: 's2', title: 'Meditation', done: false, minutes: 10 },
          ],
        },
      ],
    },
  }
  const text = JSON.stringify(withSteps)

  const first = importJson(text)
  const task = first.days['2026-09-01'].tasks[0]
  // Not one step lost, and the field itself is gone.
  expect(task.note).toBe('Before anything else.\n\n- Water\n- Meditation (10 min)')
  expect('subtasks' in task).toBe(false)

  // The same file again, and the note does not grow.
  expect(importJson(text).days['2026-09-01'].tasks[0].note).toBe(task.note)
  // And the migrated file, exported and imported back.
  expect(importJson(exportJson(first)).days['2026-09-01'].tasks[0].note).toBe(task.note)
})
