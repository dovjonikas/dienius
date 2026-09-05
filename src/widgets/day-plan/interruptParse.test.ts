import { expect, test } from 'vitest'
import { fold, parseInterruptLine, resolveDay, stripTokens, withTitle } from './interruptParse'

const t = (h: number, m = 0) => h * 60 + m

// 2026-09-10 is a Thursday.
const THURSDAY = '2026-09-10'

function parsed(line: string) {
  const { spans: _spans, ...rest } = parseInterruptLine(line)
  return rest
}

/**
 * The line the owner would type with the phone at their ear, in either
 * language, and what has to come out of it: the day, the time, the name.
 * Nothing here is a grammar - it is the table of words that get said about
 * a day, and a word not in the table is the name.
 */
test('English: a day, a range and a name', () => {
  expect(parsed('tomorrow 10-13 dad')).toEqual({ day: { offset: 1 }, start: t(10), end: t(13), title: 'dad' })
})

test('English: a weekday and a part of the day, with nothing else to say', () => {
  expect(parsed('thu afternoon')).toEqual({ day: { weekday: 4 }, shape: 'afternoon', title: '' })
  expect(parsed('Friday morning dentist')).toEqual({ day: { weekday: 5 }, shape: 'morning', title: 'dentist' })
})

test('English: a clock time in the twelve-hour form, and a length', () => {
  expect(parsed('tomorrow 2pm dentist 30min')).toEqual({ day: { offset: 1 }, start: t(14), minutes: 30, title: 'dentist' })
  expect(parsed('2-4pm dad')).toEqual({ start: t(14), end: t(16), title: 'dad' })
  expect(parsed('at 9:30 school run 1h30')).toEqual({ start: t(9, 30), minutes: 90, title: 'school run' })
})

test('Lithuanian: the short forms the owner writes', () => {
  expect(parsed('ryt 10 val tetis')).toEqual({ day: { offset: 1 }, start: t(10), title: 'tetis' })
  expect(parsed('poryt vakare mama')).toEqual({ day: { offset: 2 }, shape: 'evening', title: 'mama' })
  expect(parsed('pn ryte')).toEqual({ day: { weekday: 5 }, shape: 'morning', title: '' })
  expect(parsed('kt po pietų')).toEqual({ day: { weekday: 4 }, shape: 'afternoon', title: '' })
  expect(parsed('st visą dieną tetis')).toEqual({ day: { weekday: 6 }, shape: 'whole', title: 'tetis' })
})

test('Lithuanian: a weekday in the case a sentence puts it in, a time, a length', () => {
  expect(parsed('ketvirtadienį 14:00 dantistas 30min')).toEqual({ day: { weekday: 4 }, start: t(14), minutes: 30, title: 'dantistas' })
  expect(parsed('rytoj nuo 10 iki 13 tetis')).toEqual({ day: { offset: 1 }, start: t(10), end: t(13), title: 'tetis' })
  expect(parsed('šeštadienis 2 valandas sodas')).toEqual({ day: { weekday: 6 }, minutes: 120, title: 'sodas' })
})

/**
 * Open-ended. "From ten" with nothing closing it is open; a length or an
 * end closes it; said in words it stays open whatever else was typed.
 */
test('a start with no end is open-ended, until something closes it', () => {
  expect(parsed('from 10 dad')).toEqual({ start: t(10), open: true, title: 'dad' })
  expect(parsed('from 10 dad 2h')).toEqual({ start: t(10), minutes: 120, title: 'dad' })
  expect(parsed('ryt nuo 9 nezinau kiek')).toEqual({ day: { offset: 1 }, start: t(9), open: true, title: 'kiek' })
  expect(parsed("tomorrow 10:00 dad, don't know how long")).toEqual({ day: { offset: 1 }, start: t(10), open: true, title: 'dad' })
  expect(parsed('until 13 school')).toEqual({ end: t(13), title: 'school' })
})

/**
 * What is not a token. A bare number is a number, "an" before a vowel is
 * the article, "St." is a saint, and yesterday is not the evening.
 */
test('a bare number, an article and a saint stay in the name', () => {
  expect(parsed('call dad 2')).toEqual({ title: 'call dad 2' })
  expect(parsed('an hour with dad tomorrow')).toEqual({ day: { offset: 1 }, title: 'an hour with dad' })
  expect(parsed('St. John 10:00')).toEqual({ start: t(10), title: 'St. John' })
  expect(parsed('vakar buvo gerai')).toEqual({ title: 'vakar buvo gerai' })
  expect(parsed('25:00 nonsense')).toEqual({ title: '25:00 nonsense' })
})

test('a range that runs backwards is not a range', () => {
  expect(parsed('15-13 dad')).toEqual({ title: '15-13 dad' })
})

test('the fold keeps one character per character, so a match cuts the right span', () => {
  expect(fold('Ketvirtadienį 14:00')).toBe('ketvirtadieni 14:00')
  expect(fold('Šeštadienis').length).toBe('Šeštadienis'.length)
})

/**
 * The chips take words out of the line rather than the line rewriting
 * itself: after tapping a day, the line no longer says a day, so the two
 * cannot disagree. A recent name replaces only the name.
 */
test('a kind of word can be taken out of the line, leaving the rest as typed', () => {
  expect(stripTokens('tomorrow 10-13 dad', ['day'])).toBe('10-13 dad')
  expect(stripTokens('tomorrow 10-13 dad', ['time'])).toBe('tomorrow dad')
  expect(stripTokens('thu afternoon', ['shape'])).toBe('thu ')
  expect(stripTokens('just a name', ['day', 'time'])).toBe('just a name')
})

test('a name replaces the name and keeps every token in its order', () => {
  expect(withTitle('ryt 10-13 tetis', 'Mama')).toBe('ryt 10-13 Mama')
  expect(withTitle('', 'Dad')).toBe('Dad')
  expect(withTitle('thu afternoon', 'Dentist')).toBe('thu afternoon Dentist')
})

/**
 * A weekday means the next one, never today - the palette's rule, kept.
 */
test('a day word resolves against today', () => {
  expect(resolveDay({ offset: 0 }, THURSDAY)).toBe(THURSDAY)
  expect(resolveDay({ offset: 1 }, THURSDAY)).toBe('2026-09-11')
  expect(resolveDay({ offset: 2 }, THURSDAY)).toBe('2026-09-12')
  expect(resolveDay({ weekday: 5 }, THURSDAY)).toBe('2026-09-11')
  expect(resolveDay({ weekday: 4 }, THURSDAY)).toBe('2026-09-17')
  expect(resolveDay({ weekday: 1 }, THURSDAY)).toBe('2026-09-14')
})
