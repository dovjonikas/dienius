import { beforeEach, expect, test, vi } from 'vitest'
import { defaultData, loadData, saveData, importJson, exportJson, STORAGE_KEY } from './storage'

beforeEach(() => localStorage.clear())

test('loadData returns default data when storage is empty', () => {
  const data = loadData()
  expect(data.templates).toEqual([])
  expect(data.days).toEqual({})
  expect(data.settings.theme).toBe('light')
})

test('saveData then loadData round-trips', () => {
  const data = defaultData()
  data.templates.push({ id: 't1', name: 'Work day', color: '#8ab6f9', blocks: [] })
  expect(saveData(data)).toBe(true)
  expect(loadData().templates[0].name).toBe('Work day')
})

test('loadData falls back to defaults on corrupt JSON', () => {
  localStorage.setItem(STORAGE_KEY, '{not json')
  expect(loadData().templates).toEqual([])
})

test('importJson round-trips through exportJson', () => {
  const data = defaultData()
  data.days['2026-09-01'] = { date: '2026-09-01', tasks: [] }
  const imported = importJson(exportJson(data))
  expect(imported.days['2026-09-01'].date).toBe('2026-09-01')
})

test('importJson rejects invalid payloads', () => {
  expect(() => importJson('{"hello": 1}')).toThrow('Invalid Dienius backup file')
  expect(() => importJson('not json')).toThrow('Invalid Dienius backup file')
})

test('saveData returns false when localStorage.setItem throws', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem')
  spy.mockImplementation(() => {
    throw new Error('quota exceeded')
  })
  const data = defaultData()
  expect(saveData(data)).toBe(false)
  spy.mockRestore()
})

test('loadData falls back to defaults on schema mismatch', () => {
  localStorage.setItem(STORAGE_KEY, '{"hello": 1, "world": 2}')
  expect(loadData().templates).toEqual([])
  expect(loadData().days).toEqual({})
  expect(loadData().settings.theme).toBe('light')
})
