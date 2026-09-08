import { expect, test } from 'vitest'
import { datesWithNotes, isTaskMarkOnly, notesOn, scratchCount, scratchTitle, sortScratch } from './scratch'
import type { ScratchNote } from './types'

function note(id: string, text: string, patch: Partial<ScratchNote> = {}): ScratchNote {
  return { id, text, createdAt: `2026-09-0${id.length}T10:0${id.length}:00.000Z`, date: '2026-09-03', ...patch }
}

/**
 * A # in a note is a character in a sentence. It was a filter until v2.5 -
 * a row of chips over the stream, a markdown export for the #bug ones - and
 * the owner never used any of it, while reading the text for tags is a
 * question asked at the one moment this layer exists to keep free. Notes
 * written when it meant something are untouched, so this is what a stored
 * # now does: nothing. DECISIONS "Notes are notes".
 */
test('a # is text, kept and read back exactly as it was typed', () => {
  const n = note('a', 'Call Ana #bug about the #Calendar')
  expect(n.text).toBe('Call Ana #bug about the #Calendar')
  expect(scratchTitle(n.text)).toBe('Call Ana #bug about the #Calendar')
  expect(sortScratch([n])[0].text).toBe('Call Ana #bug about the #Calendar')
})

// Pinned first, then newest first. The one order a stream has.
test('pinned notes come first, and within each group the newest is on top', () => {
  const notes = [note('a', 'oldest'), note('ab', 'middle', { pinned: true }), note('abc', 'newest')]
  expect(sortScratch(notes).map(n => n.text)).toEqual(['middle', 'newest', 'oldest'])
})

test('a search result title is the first non-empty line, shortened', () => {
  expect(scratchTitle('\n\nSecond line is first\nmore')).toBe('Second line is first')
  expect(scratchTitle('x'.repeat(80), 20)).toBe(`${'x'.repeat(19)}...`)
})

// The count is a fact, never a badge: no colour, no "unprocessed".
test('the count reads as plain words', () => {
  expect(scratchCount(0)).toBe('Nothing yet')
  expect(scratchCount(1)).toBe('1 note')
  expect(scratchCount(27)).toBe('27 notes')
})

/**
 * The mark on its own is the moment between typing "!" and the first letter
 * after it. The regex used to read /^s*!s*$/ - the backslashes were missing,
 * so it matched literal letters rather than spaces, and " !" or "! " was
 * written to the stream and deleted again one keystroke later, leaving a
 * commit and an undo-able delete behind. Found while writing the scratch
 * e2e test in v1.11.
 */
test('the task mark on its own, with or without spaces around it, is not yet a note', () => {
  expect(isTaskMarkOnly('!')).toBe(true)
  expect(isTaskMarkOnly(' !')).toBe(true)
  expect(isTaskMarkOnly('! ')).toBe(true)
  expect(isTaskMarkOnly('  !  ')).toBe(true)
  expect(isTaskMarkOnly('!b')).toBe(false)
  expect(isTaskMarkOnly('s!s')).toBe(false)
  expect(isTaskMarkOnly('')).toBe(false)
})

/**
 * Reading the stream by day, for the month cell's mark and the day card's
 * Notes button.
 *
 * A note carries the day it was written on, so this is a reading rather than
 * a second shelf - CONVENTIONS section 11 is about what is asked at the
 * moment of writing, and this asks nothing. An empty note is not writing: the
 * one that exists for the moment between opening the box and typing the first
 * letter must not put a mark on the day.
 */
test('the notes written on one day, newest first, and never the empty one', () => {
  const notes = [
    note('a', 'The number is 8812', { date: '2026-09-03', createdAt: '2026-09-03T09:00:00.000Z' }),
    note('bb', 'Ring the dentist', { date: '2026-09-03', createdAt: '2026-09-03T17:00:00.000Z' }),
    note('ccc', 'Something else', { date: '2026-09-04' }),
    note('dddd', '   ', { date: '2026-09-03' }),
  ]
  expect(notesOn(notes, '2026-09-03').map(n => n.id)).toEqual(['bb', 'a'])
  expect(notesOn(notes, '2026-09-05')).toEqual([])
})

test('the days with anything written on them, as one walk of the stream', () => {
  const notes = [
    note('a', 'One', { date: '2026-09-03' }),
    note('bb', 'Two', { date: '2026-09-03' }),
    note('ccc', '', { date: '2026-09-04' }),
    note('dddd', 'Three', { date: '2026-09-05' }),
  ]
  expect([...datesWithNotes(notes)].sort()).toEqual(['2026-09-03', '2026-09-05'])
})

// A note is its words or its pictures. A screenshot pasted before a single
// word is typed is a note, and the day it was pasted on has writing on it.
test('a note that is only a picture still counts as something written', () => {
  const picture = note('a', '', { photos: [{ id: 'p1', width: 10, height: 10 }] })
  expect(datesWithNotes([picture]).has('2026-09-03')).toBe(true)
})
