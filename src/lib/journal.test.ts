import { expect, test } from 'vitest'
import { daysWithJournal, hasJournal, journalMarkdown, mergeJournal } from './journal'
import type { DayPlan } from './types'

function day(date: string, journal?: DayPlan['journal']): DayPlan {
  return journal ? { date, tasks: [], journal } : { date, tasks: [] }
}

/**
 * Three lines a day, none required, and a blank one is nothing rather than
 * an empty string: a day nobody wrote on carries no key, so it takes no
 * bytes and changes no sync entity.
 */
test('a line is trimmed as it is kept, and a blank one is dropped rather than kept empty', () => {
  expect(mergeJournal(undefined, { intent: '  Ship the pricing page  ' })).toEqual({ intent: 'Ship the pricing page' })
  expect(mergeJournal({ intent: 'Ship it', real: 'It shipped' }, { real: '   ' })).toEqual({ intent: 'Ship it' })
})

test('a field the patch does not mention is left alone, and a cleared last field leaves nothing at all', () => {
  expect(mergeJournal({ intent: 'Ship it', tomorrow: 'Rest' }, { real: 'A walk' })).toEqual({ intent: 'Ship it', real: 'A walk', tomorrow: 'Rest' })
  expect(mergeJournal({ intent: 'Ship it' }, { intent: '' })).toBeUndefined()
  expect(mergeJournal(undefined, {})).toBeUndefined()
})

test('a day has a journal only when one of its lines says something', () => {
  expect(hasJournal(day('2026-09-07'))).toBe(false)
  expect(hasJournal(day('2026-09-07', {}))).toBe(false)
  expect(hasJournal(day('2026-09-07', { tomorrow: 'Sleep' }))).toBe(true)
  expect(daysWithJournal({ a: day('a', { intent: 'x' }), b: day('b') }, ['a', 'b', 'c'])).toEqual(['a'])
})

/**
 * The copy: a heading, one section per day that has something written,
 * each line as a list item, and nothing for the days that had none. It is
 * for pasting into another chat, so it has to read as a document on its
 * own and never as a record of what was skipped.
 */
test('the markdown lists the days with something written, in order, and only the lines they have', () => {
  const days = {
    '2026-09-07': day('2026-09-07', { intent: 'Ship the pricing page', real: 'It shipped, late', tomorrow: 'Start with the walk' }),
    '2026-09-08': day('2026-09-08'),
    '2026-09-09': day('2026-09-09', { real: 'Dad called' }),
  }
  const text = journalMarkdown(days, ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'], '7 - 13 September 2026')
  expect(text).toBe(
    [
      '# Journal, 7 - 13 September 2026',
      '',
      '## Monday, September 7',
      '',
      '- **Today:** Ship the pricing page',
      '- **What was real today:** It shipped, late',
      '- **To myself, tomorrow:** Start with the walk',
      '',
      '## Wednesday, September 9',
      '',
      '- **What was real today:** Dad called',
      '',
    ].join('\n'),
  )
})

test('a stretch with nothing written is a heading and nothing under it', () => {
  expect(journalMarkdown({}, ['2026-09-07'], '7 - 13 September 2026')).toBe('# Journal, 7 - 13 September 2026\n')
})

test('nothing in the copy counts, ranks or says what was skipped', () => {
  const days = { '2026-09-07': day('2026-09-07', { intent: 'One line' }) }
  const text = journalMarkdown(days, ['2026-09-07', '2026-09-08'], 'a week')
  expect(text).not.toMatch(/skipped|missed|streak|\d+ of \d+|empty|nothing written/i)
})
