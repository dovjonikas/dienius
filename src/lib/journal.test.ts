import { expect, test } from 'vitest'
import type { DayPlan } from './types'
import { daysWithJournal, hasJournal, journalMarkdown, mergeOldJournal, searchJournal } from './journal'

/**
 * A journal, not a form.
 *
 * v2.3 asked three questions on a schedule: a line in the morning about
 * what the day was for, and two on the evening close card. The owner's
 * verdict on all of it was "fuck it, too much" - which is the honest
 * outcome of a form that appears every evening with three empty boxes in
 * it. See DECISIONS "A journal, not a form".
 *
 * What is left is a day and whatever somebody wanted to say on it. No
 * questions, no fields, no count of the days with nothing on them.
 */

function day(date: string, journal?: string): DayPlan {
  return { date, tasks: [], ...(journal === undefined ? {} : { journal }) }
}

// --- what counts as written ------------------------------------------------

test('a day with words has a journal, and a day with none has nothing', () => {
  expect(hasJournal(day('2026-09-16', 'It rained all afternoon.'))).toBe(true)
  expect(hasJournal(day('2026-09-16'))).toBe(false)
  expect(hasJournal(undefined)).toBe(false)
})

test('whitespace is not writing', () => {
  expect(hasJournal(day('2026-09-16', '   \n  '))).toBe(false)
})

test('the days with something on them, in order, and nothing said about the rest', () => {
  const days = {
    '2026-09-14': day('2026-09-14', 'Monday'),
    '2026-09-15': day('2026-09-15'),
    '2026-09-16': day('2026-09-16', 'Wednesday'),
  }
  expect(daysWithJournal(days, ['2026-09-14', '2026-09-15', '2026-09-16'])).toEqual(['2026-09-14', '2026-09-16'])
})

// --- the way out -----------------------------------------------------------

test('a stretch of days copies as markdown, a heading per day that has words', () => {
  const days = {
    '2026-09-14': day('2026-09-14', 'Rained all day.\nWalked anyway.'),
    '2026-09-15': day('2026-09-15'),
    '2026-09-16': day('2026-09-16', 'Better.'),
  }
  const text = journalMarkdown(days, ['2026-09-14', '2026-09-15', '2026-09-16'], 'week of 14 September')
  expect(text).toBe(
    [
      '# Journal, week of 14 September',
      '',
      '## Monday, September 14',
      '',
      'Rained all day.',
      'Walked anyway.',
      '',
      '## Wednesday, September 16',
      '',
      'Better.',
      '',
    ].join('\n'),
  )
})

test('a stretch with nothing written is a heading and nothing under it, never a list of blank days', () => {
  const text = journalMarkdown({ '2026-09-15': day('2026-09-15') }, ['2026-09-15'], 'September')
  expect(text).toBe('# Journal, September\n')
})

// --- finding something again -----------------------------------------------

test('search finds the days a word is on, newest first', () => {
  const days = {
    '2026-09-14': day('2026-09-14', 'Ada called about the dentist'),
    '2026-09-15': day('2026-09-15', 'Nothing much'),
    '2026-09-16': day('2026-09-16', 'The dentist again'),
  }
  expect(searchJournal(days, 'dentist')).toEqual(['2026-09-16', '2026-09-14'])
})

test('search does not care about case, and an empty search finds nothing rather than everything', () => {
  const days = { '2026-09-14': day('2026-09-14', 'Ada called') }
  expect(searchJournal(days, 'ADA')).toEqual(['2026-09-14'])
  expect(searchJournal(days, '   ')).toEqual([])
})

// --- what v2.3 left behind -------------------------------------------------

/**
 * Nothing anybody wrote is lost. The three fields become one entry, in the
 * order the day said them, each on its own line - so a day that had all
 * three reads as a short paragraph and a day that had one reads as that
 * line. No labels, no questions: the words are what was kept, and the
 * questions they were answers to were the thing being removed.
 */
test('the three old lines become one entry, in the order the day said them', () => {
  expect(
    mergeOldJournal({ intent: 'Ship the pricing page', real: 'It shipped', tomorrow: 'Start earlier' }),
  ).toBe('Ship the pricing page\nIt shipped\nStart earlier')
})

test('a day that only answered one keeps that one, alone', () => {
  expect(mergeOldJournal({ real: 'It shipped' })).toBe('It shipped')
})

test('an empty old journal becomes nothing rather than an empty string', () => {
  expect(mergeOldJournal({})).toBeUndefined()
  expect(mergeOldJournal(undefined)).toBeUndefined()
  expect(mergeOldJournal({ intent: '   ' })).toBeUndefined()
})

test('something already written as free text is left exactly as it is', () => {
  expect(mergeOldJournal('It rained.\nWalked anyway.')).toBe('It rained.\nWalked anyway.')
})
