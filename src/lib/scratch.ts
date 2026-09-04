import type { ScratchNote } from './types'

/**
 * Scratch: the layer under everything else, for the thing that has to be
 * written down in the next second.
 *
 * A phone number said once, a bug noticed while doing something else, a
 * thought with nowhere to go yet. The inbox is for tasks that have not been
 * given a day; this is for text that has not been given anything, and the
 * whole design is that nothing is asked at the moment of writing - not where
 * it goes, not what kind of thing it is, not whether it matters. Sorting
 * happens later, if at all, from the note itself: it can become a task, go
 * to the inbox, be pinned, or be deleted.
 *
 * One stream. No folders, no notebooks, no formatting, no attachments. A
 * note that needs structure has stopped being scratch and is a task or a
 * document somewhere else - see CONVENTIONS.md. The one piece of structure
 * that survives is a word with a # in front of it, which is a filter, not a
 * folder: the note is still in the stream, it just also answers to a name.
 */

/** The tag that marks a note as something to hand to a bugfix session - see `bugExport`. */
export const BUG_TAG = 'bug'

const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu

/** Every #tag in a note, lowercased, in order of first appearance, without duplicates. */
export function scratchTags(text: string): string[] {
  const out: string[] = []
  for (const match of text.matchAll(TAG_RE)) {
    const tag = match[1].toLowerCase()
    if (!out.includes(tag)) out.push(tag)
  }
  return out
}

export function hasTag(note: ScratchNote, tag: string): boolean {
  return scratchTags(note.text).includes(tag.toLowerCase())
}

export interface ScratchTagCount {
  tag: string
  count: number
}

/** Every tag in use across the stream, most used first, ties by name. */
export function allScratchTags(notes: ScratchNote[]): ScratchTagCount[] {
  const counts = new Map<string, number>()
  for (const note of notes) {
    for (const tag of scratchTags(note.text)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count === a.count ? a.tag.localeCompare(b.tag) : b.count - a.count))
}

/** The text with its #tags taken out - what a task or an inbox line is made from. */
export function stripTags(text: string): string {
  return text.replace(TAG_RE, ' ').replace(/[ \t]+/g, ' ').replace(/^ | $/gm, '').trim()
}

/** Pinned first, then newest first. The one order a stream has. */
export function sortScratch(notes: ScratchNote[]): ScratchNote[] {
  return [...notes].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function filterScratch(notes: ScratchNote[], tag: string | null): ScratchNote[] {
  if (!tag) return notes
  return notes.filter(n => hasTag(n, tag))
}

/**
 * The #bug notes as a markdown list, oldest first, one line each, the tag
 * itself taken out. Built to be pasted straight into a bugfix prompt: a date
 * so the reader knows which build it was seen on, and the sentence as it
 * was written at the time.
 */
export function bugExport(notes: ScratchNote[]): string {
  return notes
    .filter(n => hasTag(n, BUG_TAG))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(n => `- ${n.date}: ${stripTags(n.text).replace(/\s*\n+\s*/g, ' ')}`)
    .join('\n')
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
 * going, not part of what it says, so an inbox line that arrives reading
 * "!book the dentist" would be the mark leaking into the thing it was
 * steering.
 */
export function stripTaskMark(text: string): string {
  return text.replace(/^\s*!\s*/, '')
}
