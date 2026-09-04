import { expect, test } from 'vitest'
import {
  allScratchTags,
  bugExport,
  filterScratch,
  isTaskMarkOnly,
  scratchCount,
  scratchTags,
  scratchTitle,
  sortScratch,
  stripTags,
} from './scratch'
import type { ScratchNote } from './types'

function note(id: string, text: string, patch: Partial<ScratchNote> = {}): ScratchNote {
  return { id, text, createdAt: `2026-09-0${id.length}T10:0${id.length}:00.000Z`, date: '2026-09-03', ...patch }
}

/**
 * A #tag is a filter, not a folder - see CONVENTIONS.md section 11. It is
 * read out of the text and never stored beside it, so a note keeps exactly
 * the words that were typed and the tag can be renamed by editing them.
 */
test('tags are the words with a # in front, lowercased, once each, in order', () => {
  expect(scratchTags('Call Ana #bug about the #Calendar #bug')).toEqual(['bug', 'calendar'])
  expect(scratchTags('#first line\nand #second')).toEqual(['first', 'second'])
})

test('a # inside a word or a number is not a tag', () => {
  expect(scratchTags('room#12 costs #40')).toEqual(['40'])
  expect(scratchTags('C# and F# are languages')).toEqual([])
})

test('tags are counted across the stream, most used first', () => {
  const notes = [note('a', '#bug one'), note('ab', '#bug two #idea'), note('abc', '#idea three #bug')]
  expect(allScratchTags(notes)).toEqual([
    { tag: 'bug', count: 3 },
    { tag: 'idea', count: 2 },
  ])
})

test('stripping tags leaves the sentence, without doubled spaces', () => {
  expect(stripTags('Calendar cells overlap #bug at 390px')).toBe('Calendar cells overlap at 390px')
  expect(stripTags('#bug Calendar cells overlap')).toBe('Calendar cells overlap')
})

// Pinned first, then newest first. The one order a stream has.
test('pinned notes come first, and within each group the newest is on top', () => {
  const notes = [note('a', 'oldest'), note('ab', 'middle', { pinned: true }), note('abc', 'newest')]
  expect(sortScratch(notes).map(n => n.text)).toEqual(['middle', 'newest', 'oldest'])
})

test('filtering by a tag keeps only the notes that carry it', () => {
  const notes = [note('a', '#bug one'), note('ab', 'plain two'), note('abc', 'three #BUG')]
  expect(filterScratch(notes, 'bug').map(n => n.id)).toEqual(['a', 'abc'])
  expect(filterScratch(notes, null)).toHaveLength(3)
})

/**
 * The export is built to be pasted into a bugfix prompt: one line per note,
 * the date it was seen on, the sentence as written, the tag itself gone.
 * Oldest first, because that is the order they were noticed in.
 */
test('the bug export is a markdown list, oldest first, tag removed, one line per note', () => {
  const notes = [
    note('abc', '#bug Week title\nwraps at 390', { date: '2026-09-03' }),
    note('a', 'Calendar cells overlap #bug', { date: '2026-09-01' }),
    note('ab', 'Not a bug, an #idea'),
  ]
  expect(bugExport(notes)).toBe('- 2026-09-01: Calendar cells overlap\n- 2026-09-03: Week title wraps at 390')
})

test('with no bug notes the export is empty rather than a header with nothing under it', () => {
  expect(bugExport([note('a', 'plain')])).toBe('')
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
