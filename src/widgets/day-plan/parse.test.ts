import { parseQuickAdd } from './parse'

test('parses a leading HH:MM time', () => {
  expect(parseQuickAdd('14:00 Call mom')).toEqual({ time: '14:00', title: 'Call mom' })
})

test('pads single digit hours', () => {
  expect(parseQuickAdd('9:30 Gym')).toEqual({ time: '09:30', title: 'Gym' })
})

test('treats plain text as an untimed task', () => {
  expect(parseQuickAdd('Buy milk')).toEqual({ title: 'Buy milk' })
})

test('returns null for empty input', () => {
  expect(parseQuickAdd('   ')).toBeNull()
})
