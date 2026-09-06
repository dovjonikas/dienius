import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData, exportJson, importJson, loadData, saveData, STORAGE_KEY } from './storage'
import { collectEntities } from './syncEntities'
import { validate } from './validate'

const DATE = '2026-09-07'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * The writing rides on the day. One action, trimmed, and absent when blank -
 * so the day entity a device syncs, the backup that is exported and the
 * snapshot that is kept all carry it without any of them having to know the
 * journal exists.
 */
test('what is written is kept on the day, and clearing it leaves the day without a journal at all', () => {
  actions.setJournal(DATE, 'It rained all afternoon.')
  expect(getData().days[DATE].journal).toBe('It rained all afternoon.')

  actions.setJournal(DATE, '   ')
  expect('journal' in getData().days[DATE]).toBe(false)
})

test('writing nothing on a day that had nothing does not even make the day', () => {
  actions.setJournal(DATE, '')
  expect(getData().days[DATE]).toBeUndefined()
})

test('the journal travels as part of the day entity', () => {
  actions.setJournal(DATE, 'Start with the walk')
  const body = collectEntities(getData()).get(`day:${DATE}`)!.bodyOf() as { journal?: unknown }
  expect(body.journal).toBe('Start with the walk')
})

test('a backup carries it and loads it back, and a journal that is not text is refused with the payload', () => {
  actions.setJournal(DATE, 'One line\nTwo')
  const text = exportJson(getData())
  expect(importJson(text).days[DATE].journal).toBe('One line\nTwo')

  const broken = JSON.parse(text)
  broken.days[DATE].journal = 7
  expect(validate(broken)).toBe(false)
})

/**
 * What v2.3 wrote is not lost. Three named answers become one entry, in the
 * order the day said them, each on its own line - see `mergeOldJournal` and
 * DECISIONS "A journal, not a form". Folded on load, so nothing downstream
 * ever sees two shapes and nobody has to be told anything happened.
 */
test('a day written by v2.3 loads as one entry, with every line kept', () => {
  const stored = defaultData() as unknown as { days: Record<string, unknown> }
  stored.days[DATE] = {
    date: DATE,
    tasks: [],
    journal: { intent: 'Ship the pricing page', real: 'It shipped', tomorrow: 'Start earlier' },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

  expect(loadData().days[DATE].journal).toBe('Ship the pricing page\nIt shipped\nStart earlier')
})

test('a v2.3 backup restores rather than being refused', () => {
  const stored = defaultData() as unknown as { days: Record<string, unknown> }
  stored.days[DATE] = { date: DATE, tasks: [], journal: { real: 'It shipped' } }
  const text = JSON.stringify(stored)

  expect(validate(JSON.parse(text))).toBe(true)
  expect(importJson(text).days[DATE].journal).toBe('It shipped')
})

test('a day that only ever had an empty v2.3 journal loads with none at all', () => {
  const stored = defaultData() as unknown as { days: Record<string, unknown> }
  stored.days[DATE] = { date: DATE, tasks: [], journal: {} }
  saveData(stored as never)

  expect('journal' in loadData().days[DATE]).toBe(false)
})
