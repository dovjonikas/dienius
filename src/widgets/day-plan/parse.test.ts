import { durationToText, parseQuickAdd, replaceLeadingTime, replaceTrailingDuration } from './parse'

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

/**
 * The trailing duration, and the shape of it that was documented from v1.0
 * but never actually read. The rule these defend is the one the anchoring
 * exists for: a number is only a length when a unit says so, except after an
 * hour, where "1h30" can mean nothing else.
 */
test('reads a duration written with both units', () => {
  expect(parseQuickAdd('Walk 1h 30min')).toEqual({ title: 'Walk', minutes: 90 })
})

test('reads the minutes after an hour with no unit of their own', () => {
  // Claimed by this parser's own doc comment since v1.0 and not true until
  // now: the minutes group insisted on an "m", so "1h30" matched nothing at
  // all and the whole line kept its digits as part of the title.
  expect(parseQuickAdd('Walk 1h30')).toEqual({ title: 'Walk', minutes: 90 })
})

test('reads a bare hour', () => {
  expect(parseQuickAdd('Walk 1h')).toEqual({ title: 'Walk', minutes: 60 })
})

test('reads hours written out', () => {
  expect(parseQuickAdd('Walk 2 hours')).toEqual({ title: 'Walk', minutes: 120 })
})

test('reads minutes written several ways', () => {
  expect(parseQuickAdd('Walk 90m')).toEqual({ title: 'Walk', minutes: 90 })
  expect(parseQuickAdd('Walk 45 minutes')).toEqual({ title: 'Walk', minutes: 45 })
})

test('leaves a number that is part of the title alone', () => {
  expect(parseQuickAdd('Read 20 pages')).toEqual({ title: 'Read 20 pages' })
})

test('a bare trailing number is still not a duration', () => {
  expect(parseQuickAdd('Call 42')).toEqual({ title: 'Call 42' })
})

test('a duration of zero is the absence of one, not a size', () => {
  expect(parseQuickAdd('Walk 0min')).toEqual({ title: 'Walk 0min' })
})

test('reads a time and a duration out of the same line', () => {
  expect(parseQuickAdd('14:00 Call mom 45min')).toEqual({ time: '14:00', title: 'Call mom', minutes: 45 })
})

/**
 * Quick-add's controls and its text are one thing. When the line carries its
 * own time or duration, pushing an arrow or tapping a chip rewrites the
 * words - so these two have to round-trip through parseQuickAdd exactly, or
 * the field would say one thing and the chips under it another.
 */
test('a duration is written back in a form this same parser reads', () => {
  for (const minutes of [15, 30, 45, 60, 90, 125]) {
    expect(parseQuickAdd(`Walk ${durationToText(minutes)}`)).toEqual({ title: 'Walk', minutes })
  }
})

test('swapping the leading time keeps the spacing and the words', () => {
  expect(replaceLeadingTime('9:30  Gym then lunch', '10:00')).toBe('10:00  Gym then lunch')
})

test('a line with no leading time is left exactly as typed', () => {
  expect(replaceLeadingTime('Gym', '10:00')).toBe('Gym')
})

test('swapping the trailing duration keeps whatever came before it', () => {
  expect(replaceTrailingDuration('14:00 Call mom 45min', 30)).toBe('14:00 Call mom 30min')
})

test('a trailing space survives a swapped duration, so the cursor does not jump', () => {
  expect(replaceTrailingDuration('Walk 1h ', 30)).toBe('Walk 30min ')
})

test('a line with no duration is left exactly as typed', () => {
  expect(replaceTrailingDuration('Call mom', 30)).toBe('Call mom')
})

test('a number the parser reads as part of the title is not swapped either', () => {
  expect(replaceTrailingDuration('Read 20 pages', 30)).toBe('Read 20 pages')
})
