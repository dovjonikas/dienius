import type { ScratchNote } from './types'

/**
 * Scratch: the layer under everything else, for the thing that has to be
 * written down in the next second.
 *
 * A phone number said once, a bug noticed while doing something else, a
 * thought with nowhere to go yet. Later is for things to do that have not
 * been given a day; this is for text that has not been given anything, and
 * the whole design is that nothing is asked at the moment of writing - not
 * where it goes, not what kind of thing it is, not whether it matters.
 * Sorting happens later, if at all, from the note itself: it can become a
 * task, go to Later, be pinned, or be deleted.
 *
 * One stream. No folders, no notebooks, no formatting. A note that needs
 * structure has stopped being scratch and is a task or a document somewhere
 * else - see CONVENTIONS.md.
 *
 * There were #tags here for four versions: a word with a # in front of it
 * was a filter, a row of chips sat above the stream, and #bug notes could be
 * copied out as a markdown list. The owner never used them, and they cost
 * something at the one moment this layer exists to keep free - the moment of
 * writing, where a tag is a small question about where the thing goes. So
 * the text is now exactly the text: no parsing, no colouring, and a # typed
 * before v2.5 stays in the sentence as a character like any other. See
 * DECISIONS "Notes are notes".
 */

/**
 * Whether a note says anything at all. A note is its words or its pictures,
 * and the empty one that exists for the moment between opening the box and
 * typing the first letter is neither.
 */
export function noteHasSomething(note: ScratchNote): boolean {
  return !!note.text.trim() || !!note.photos?.length
}

/**
 * The notes written on one day, newest first.
 *
 * A note is not filed under a day - it is one stream, and it always will be
 * (CONVENTIONS section 11) - but every note records the day it was written
 * on, so "what was written on Wednesday" is a reading of the stream rather
 * than a second place to put things. Nothing about writing changes: a line
 * typed now is dated now, whatever day is being read.
 */
export function notesOn(notes: ScratchNote[], date: string): ScratchNote[] {
  return sortScratch(notes.filter(n => n.date === date && noteHasSomething(n)))
}

/**
 * Every day that has a note on it, as a set, for the month grid.
 *
 * A set rather than a per-cell scan: forty-two cells against a stream of a
 * few hundred notes is forty-two walks of the same list, and the month grid
 * redraws on every commit.
 */
export function datesWithNotes(notes: ScratchNote[]): Set<string> {
  const out = new Set<string>()
  for (const note of notes) {
    if (noteHasSomething(note)) out.add(note.date)
  }
  return out
}

/** Pinned first, then newest first. The one order a stream has. */
export function sortScratch(notes: ScratchNote[]): ScratchNote[] {
  return [...notes].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

/** The first line of a note, short enough for a search result or a list. */
export function scratchTitle(text: string, max = 60): string {
  const line = text.split('\n').find(l => l.trim())?.trim() ?? ''
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}...` : line
}

/**
 * "3 notes", quietly. Never a badge, never an accent colour: an old note is
 * not an accusation, and a number that grows in red is exactly the kind of
 * pressure this layer exists to take away.
 */
export function scratchCount(n: number): string {
  if (n === 0) return 'Nothing yet'
  return `${n} ${n === 1 ? 'note' : 'notes'}`
}

/**
 * Whether this line is meant as something to do rather than something to
 * remember.
 *
 * A leading "!" and nothing else. Scratch's whole value is that nothing is
 * asked at the moment of writing (CONVENTIONS.md section 11), so the way out
 * of it has to cost one character - and it has to be a character somebody
 * types deliberately, never one that falls out of ordinary prose. Leading, so
 * "That went well!" is a note and "!book the dentist" is a task; and a single
 * mark, so a line that is only exclamation marks is still just a note nobody
 * has to think about.
 *
 * The toggle beside the field is the same intent said with a tap instead. See
 * views/scratch/Scratch.tsx.
 */
export function isTaskIntent(text: string): boolean {
  return /^\s*!\s*\S/.test(text)
}

/**
 * A line that is the mark and nothing else yet.
 *
 * The moment between typing "!" and typing the first letter after it. It is
 * not a task - there is nothing to do in it - and it must not be written to
 * the stream either, because scratch saves on every keystroke and the note
 * would be created and deleted again one character later, leaving a commit
 * and an undo-able delete behind for every task anybody ever types.
 */
export function isTaskMarkOnly(text: string): boolean {
  return /^\s*!\s*$/.test(text)
}

/**
 * The line without its mark. "!" is punctuation about where the line is
 * going, not part of what it says, so a line arriving in Later reading
 * "!book the dentist" would be the mark leaking into the thing it was
 * steering.
 */
export function stripTaskMark(text: string): string {
  return text.replace(/^\s*!\s*/, '')
}
