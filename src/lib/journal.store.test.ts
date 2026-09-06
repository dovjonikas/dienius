import { beforeEach, expect, test } from 'vitest'
import { actions, getData } from './store'
import { defaultData, exportJson, importJson } from './storage'
import { collectEntities } from './syncEntities'
import { validate } from './validate'

const DATE = '2026-09-07'

beforeEach(() => {
  localStorage.clear()
  actions.resetForTests(defaultData())
})

/**
 * The lines ride on the day. Written through one action, trimmed, and
 * absent when blank - so the day entity a device syncs, the backup that is
 * exported and the snapshot that is kept all carry them without any of
 * them having to know the journal exists.
 */
test('a line is kept on the day, and clearing the last one leaves the day without a journal at all', () => {
  actions.setJournal(DATE, { intent: '  Ship the pricing page ' })
  expect(getData().days[DATE].journal).toEqual({ intent: 'Ship the pricing page' })

  actions.setJournal(DATE, { real: 'It shipped', tomorrow: '' })
  expect(getData().days[DATE].journal).toEqual({ intent: 'Ship the pricing page', real: 'It shipped' })

  actions.setJournal(DATE, { intent: '', real: '   ' })
  expect('journal' in getData().days[DATE]).toBe(false)
})

test('writing nothing on a day that had nothing writes nothing', () => {
  actions.setJournal(DATE, { intent: '' })
  expect('journal' in getData().days[DATE]).toBe(false)
})

test('the journal travels as part of the day entity', () => {
  actions.setJournal(DATE, { tomorrow: 'Start with the walk' })
  const body = collectEntities(getData()).get(`day:${DATE}`)!.bodyOf() as { journal?: unknown }
  expect(body.journal).toEqual({ tomorrow: 'Start with the walk' })
})

test('a backup carries it and loads it back, and a journal that is not text is refused with the payload', () => {
  actions.setJournal(DATE, { intent: 'One line', real: 'Two' })
  const text = exportJson(getData())
  expect(importJson(text).days[DATE].journal).toEqual({ intent: 'One line', real: 'Two' })

  const broken = JSON.parse(text)
  broken.days[DATE].journal = { intent: 7 }
  expect(validate(broken)).toBe(false)
})
