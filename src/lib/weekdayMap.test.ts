import { expect, test } from 'vitest'
import { mappedTemplateId } from './weekdayMap'
import { defaultData } from './storage'

// 2026-09-02 is a Wednesday: weekday 3.
const WEDNESDAY = '2026-09-02'

test('the weekday map gives a date the template it names for that weekday', () => {
  const data = defaultData()
  data.templates = [{ id: 'work', name: 'Work', color: '#6c8cff', blocks: [] }]
  data.settings.weekdayTemplates = { 3: 'work' }
  expect(mappedTemplateId(data, WEDNESDAY)).toBe('work')
})

test('a weekday the map leaves out gives nothing', () => {
  const data = defaultData()
  data.templates = [{ id: 'work', name: 'Work', color: '#6c8cff', blocks: [] }]
  data.settings.weekdayTemplates = { 1: 'work' }
  expect(mappedTemplateId(data, WEDNESDAY)).toBeUndefined()
})

// What a plan saved before a delete took its template off the map, or a map
// synced from an older device, still says: a name nothing answers to.
test('a map naming a template that is gone gives nothing', () => {
  const data = defaultData()
  data.settings.weekdayTemplates = { 3: 'gone' }
  expect(mappedTemplateId(data, WEDNESDAY)).toBeUndefined()
})
